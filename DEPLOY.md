# Render에 공개 사이트 배포

[배포 시작](https://render.com/deploy?repo=https://github.com/Canola-U/tiffany-site)

이 링크는 배포 설정 화면을 엽니다. 아직 사이트 주소가 생성되거나 비용이 결제된 것은 아닙니다. Render 공식 Node 예제의 Blueprint 형식을 사용하며, 실제 Render 계정의 배포는 검증 전입니다.

## 사용자가 필요한 단계

1. 위 링크에서 Render에 가입·로그인합니다. GitHub 접근을 요청하면 `Canola-U/tiffany-site` 저장소를 연결합니다. 비공개 저장소는 Render의 GitHub 접근 허용이 필요합니다.
2. Blueprint의 입력 요청에 `DISCORD_BOT_TOKEN`을 넣습니다. Discord Developer Portal → 만든 앱 → Bot에서 복사한 토큰입니다. 채팅이나 GitHub 파일에 올리지 마세요.
3. 생성될 서버와 디스크의 현재 요금을 확인하고 동의할 때 배포를 진행합니다. 이 설정은 **유료 상시 실행 서버(Starter)와 1GB 영구 디스크**를 요청합니다. 이 저장소 변경 자체는 서버를 생성하거나 결제하지 않습니다.
4. Render에서 배포 성공 상태를 확인합니다. Render가 발급한 실제 HTTPS 주소가 사이트 주소입니다. 그 주소를 이 채팅에 보내면 사이트 응답과 외부 연동 상태를 확인할 수 있습니다. 비밀값은 보내지 마세요.

만약 링크에서 저장소 연결을 찾지 못하면 Render 대시보드의 Blueprint 생성 흐름으로 GitHub 저장소를 선택합니다. 수동 서비스 생성 화면을 사용하는 경우 아래 설정을 동일하게 입력합니다. 계정별 UI의 정확한 버튼 위치는 여기서 검증하지 않았습니다.

## 수동 배포 설정

- 저장소: `Canola-U/tiffany-site`, 브랜치: `main`
- 런타임: Node.js, 버전 `24.19.0`
- 빌드: `npm ci --ignore-scripts --no-audit --no-fund && npm test`
- 시작: `npm start`
- 헬스 체크: `/healthz` (SOOP/YouTube가 일시적으로 실패해도 앱 자체의 실행 상태를 확인)
- 인스턴스: 상시 실행이 가능한 유료 단일 인스턴스
- 디스크: 1GB, 마운트 경로 `/var/data`
- 환경 변수: `NODE_ENV=production`, `DATA_DIR=/var/data/tiffany-room`, `DISCORD_CHANNEL_ID=1566736820396359711`
- 비밀 환경 변수: `DISCORD_BOT_TOKEN`, 임의의 긴 `WRITE_TOKEN` (Blueprint는 WRITE_TOKEN을 자동 생성)

기본 무료 웹 서비스는 유휴 상태에서 중지될 수 있어 1분 주기 방송 알림에는 적합하지 않습니다. 유휴 중지를 피하려고 외부에서 반복 호출하는 우회 설정은 사용하지 않습니다.

## 배포 후

- 알림: 봇이 해당 디스코드 채널을 보고 메시지를 보낼 권한이 있어야 합니다. 토큰 등록만으로 실제 발송 권한까지 증명되지는 않습니다. 서버 최초 정상 조회는 기준점으로 저장하고 이후 새 방송·영상부터 보냅니다.
- 요약 작성: Render 환경 변수의 자동 생성된 `WRITE_TOKEN`을 확인해 요약 작성 팝업의 작성 키에 입력합니다. 키를 공개하거나 이 채팅에 붙여넣지 마세요. 모든 저장된 요약은 사이트 방문자가 볼 수 있습니다.
- AI 요약: 필요하면 Render 환경 변수에 `LLM_API_KEY`를 추가합니다. OpenAI API 사용 비용이 별도로 발생할 수 있습니다. 키가 없으면 원문 발췌 기능이 동작합니다.
- Windows 앱: 공개 사이트의 알림·앱 설정에서 ZIP을 받고 실제 사이트 URL로 설치합니다. Windows 실행 검증은 아직 완료하지 않았습니다.
- SOOP/YouTube: 제공자 API 형식·제한이 바뀔 수 있습니다. `/api/status`의 실제 상태를 보고 연동을 확인해야 합니다. 이 클라우드에서는 현재 네트워크 제한으로 실제 조회가 확인되지 않았습니다.

Codex 클라우드의 환경 게시와 Render 사이트 배포는 별개입니다. Codex의 비밀값이 Render로 자동 복사되지는 않습니다. 요약과 알림 기록은 Render 영구 디스크에 저장되고, 이 개발 환경의 기존 데이터는 자동으로 이전되지 않습니다.
