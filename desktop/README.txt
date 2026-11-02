Tiffany Room / Windows 10, 11 / Windows PowerShell 5.1

1. 스크립트 내용을 검토하고 실제 운영 중인 티파니룸 사이트 주소를 준비하세요.
2. PowerShell에서 다음을 실행하세요. 예시 주소를 실제 주소로 바꿔야 합니다.
   .\install.ps1 -SiteUrl "https://your-site.example"
3. 트레이 앱이 실행되며 Windows 로그인 시 자동 시작합니다.

PC·앱·사이트 서버가 켜져 있어야 합니다. 1분마다 방송 상태를 확인합니다.
앱을 켰을 때 이미 방송 중이면 바로 엽니다. 같은 방송은 앱 실행 중 한 번만 엽니다.
트레이 메뉴에서 자동 열기를 끄거나 종료할 수 있습니다. 토글은 재시작 시 켜짐으로 초기화됩니다.
제거: 앱 종료 → 시작프로그램 폴더의 Tiffany Room.lnk 삭제 → %LOCALAPPDATA%\TiffanyRoom 삭제.

Windows 실제 실행 검증 및 코드 서명은 아직 완료하지 않았습니다.
macOS·모바일은 지원하지 않습니다. 조직의 스크립트 실행 정책을 따라주세요.
