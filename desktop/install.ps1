param([Parameter(Mandatory=$true)][string]$SiteUrl)
$ErrorActionPreference = 'Stop'
$parsed = $null
if (-not [Uri]::TryCreate($SiteUrl, [UriKind]::Absolute, [ref]$parsed) -or ($parsed.Scheme -ne 'https' -and -not ($parsed.Scheme -eq 'http' -and $parsed.Host -in @('localhost', '127.0.0.1')))) { throw '실제 HTTPS 사이트 주소를 입력해주세요. 로컬 개발만 HTTP를 허용합니다.' }
$folder = Join-Path $env:LOCALAPPDATA 'TiffanyRoom'
New-Item -ItemType Directory -Path $folder -Force | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'tiffany-companion.ps1') (Join-Path $folder 'tiffany-companion.ps1') -Force
@{siteUrl=$SiteUrl.TrimEnd('/')} | ConvertTo-Json | Set-Content (Join-Path $folder 'settings.json') -Encoding UTF8
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Startup')) 'Tiffany Room.lnk'))
$shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shortcut.Arguments = '-NoProfile -WindowStyle Hidden -STA -File "' + (Join-Path $folder 'tiffany-companion.ps1') + '"'
$shortcut.WorkingDirectory = $folder
$shortcut.Save()
Start-Process $shortcut.TargetPath -ArgumentList $shortcut.Arguments
Write-Host '설치 완료. Windows 로그인 시 자동 실행됩니다. 제거 방법은 README.txt를 확인하세요.'
