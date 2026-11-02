param([string]$SiteUrl)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$folder = Join-Path $env:LOCALAPPDATA 'TiffanyRoom'
if (-not $SiteUrl) { $SiteUrl = (Get-Content (Join-Path $folder 'settings.json') -Raw | ConvertFrom-Json).siteUrl }
$parsed = $null
if (-not [Uri]::TryCreate($SiteUrl, [UriKind]::Absolute, [ref]$parsed) -or ($parsed.Scheme -ne 'https' -and -not ($parsed.Scheme -eq 'http' -and $parsed.Host -in @('localhost', '127.0.0.1')))) { throw '설치 시 올바른 HTTPS 사이트 주소를 설정해주세요.' }
$SiteUrl = $SiteUrl.TrimEnd('/')
$mutex = New-Object System.Threading.Mutex($false, 'Local\TiffanyRoomCompanion')
if (-not $mutex.WaitOne(0)) { exit }
$script:lastBroadcast = $null
$script:checking = $false
$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = [System.Drawing.SystemIcons]::Information
$tray.Text = 'Tiffany Room - 방송 확인 중'
$tray.Visible = $true
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$open = $menu.Items.Add('티파니룸 열기')
$open.add_Click({ Start-Process $SiteUrl })
$autoOpen = $menu.Items.Add('방송 시작 시 자동으로 열기')
$autoOpen.CheckOnClick = $true
$autoOpen.Checked = $true
$exit = $menu.Items.Add('앱 종료')
$exit.add_Click({ [System.Windows.Forms.Application]::Exit() })
$tray.ContextMenuStrip = $menu
$tray.add_DoubleClick({ Start-Process $SiteUrl })
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 60000
$poll = {
    if ($script:checking) { return }
    $script:checking = $true
    try {
        $status = Invoke-RestMethod -Uri "$SiteUrl/api/status" -TimeoutSec 15
        if ($status.live.state -eq 'live') {
            $id = [string]$status.live.id
            $tray.Text = 'Tiffany Room - LIVE'
            if ($script:lastBroadcast -ne $id) {
                $tray.ShowBalloonTip(8000, '티파니 방송 시작!', [string]$status.live.title, [System.Windows.Forms.ToolTipIcon]::Info)
                if ($autoOpen.Checked) { Start-Process 'https://play.sooplive.co.kr/w96idqb' }
                $script:lastBroadcast = $id
            }
        } elseif ($status.live.state -eq 'offline') { $tray.Text = 'Tiffany Room - 다음 방송을 기다리는 중' }
        else { $tray.Text = 'Tiffany Room - 방송 연결 확인 필요' }
    } catch { $tray.Text = 'Tiffany Room - 서버 연결 확인 필요' }
    finally { $script:checking = $false }
}
$timer.add_Tick($poll)
$timer.Start()
$tray.ShowBalloonTip(5000, 'Tiffany Room', '앱 실행 중 방송 시작을 확인하고 SOOP를 자동으로 열어요.', [System.Windows.Forms.ToolTipIcon]::Info)
try { & $poll; [System.Windows.Forms.Application]::Run() }
finally { $timer.Stop(); $tray.Dispose(); $mutex.ReleaseMutex(); $mutex.Dispose() }
