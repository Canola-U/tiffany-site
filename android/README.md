# 티파니룸 Android · 서버 1분 감지 + FCM 푸시

Android 8.0(API 26) 이상에서 사이트를 보여주고, 서버의 새 방송·영상 알림을 Firebase Cloud Messaging(FCM)으로 받는 앱입니다. **폰이 15분마다 확인하는 방식 대신 서버가 1분마다 확인**합니다. 푸시도 네트워크·절전·제조사 정책에 따라 지연될 수 있어 정확히 1분 내 도착을 보장하지 않습니다.

현재 배포 APK는 개인 설치 테스트용 키 서명본입니다. Google Play 등록, 실제 휴대폰 실행 및 실제 FCM 전달 검증은 아직 완료하지 않았습니다. 기본 Google Play 서비스가 없는 기기에서는 FCM이 동작하지 않을 수 있습니다.

## Firebase 최초 연결

1. [Firebase 콘솔](https://console.firebase.google.com/)에서 프로젝트를 만듭니다. Google 애널리틱스는 필수가 아닙니다.
2. 프로젝트에 Android 앱을 추가하고 패키지 이름을 **`com.tiffanyroom.app`**으로 입력합니다.
3. `google-services.json`을 내려받습니다. 이것은 앱 연결용 공개 설정입니다. 아래 도구로 Render에 넣을 공개 JSON을 추출할 수 있습니다.

```sh
python3 android/tools/firebase-config.py /path/to/google-services.json
```

4. 현재 연결한 `tiffany-alaam` 프로젝트의 앱 공개 설정은 `config/firebase-android.json`에 반영되어 있습니다. 이 프로젝트를 사용하는 경우 별도 공개 설정 입력은 필요하지 않습니다. 다른 프로젝트로 바꾸는 경우에만 Render의 `FIREBASE_ANDROID_CONFIG_JSON`으로 위 도구의 출력 JSON을 덮어쓸 수 있습니다. 설정에는 `appId`, `apiKey`, `projectId`, `senderId`만 포함하며, 서버는 앱과 서버 서비스 계정의 프로젝트 ID가 일치하는지도 확인합니다. Firebase 보안 안내에 맞춰 앱 API 키의 사용 API·앱 제한을 구성하세요.
5. Firebase 프로젝트 설정의 서비스 계정에서 서버용 비공개 키를 생성합니다. Google의 Firebase Cloud Messaging API 사용 권한이 필요합니다. **이 키 JSON은 비밀값입니다. 채팅·GitHub에 업로드하지 마세요.** Render의 비밀 환경 변수 `FIREBASE_SERVICE_ACCOUNT_JSON`에 파일 내용 전체를 입력합니다. 서버는 이 키로 로컬에서 JWT를 서명하므로 프록시 대체용 가짜 값으로 설정하면 안 됩니다.
6. Render가 재배포된 후 `/api/status`의 `pushConfigured`와 `/api/push/config` 응답을 확인합니다. `pushConfigured`는 키 형식 존재만 뜻하며 Google 발송 권한까지 보장하지 않습니다. 실제 발송 테스트가 필요합니다.

Firebase 클라이언트 설정과 서버 서비스 계정은 **같은 프로젝트**여야 합니다. Firebase Cloud Messaging 자체와 별개로 기존 Render 서버 비용은 계속 적용됩니다. 서비스 계정 키를 앱에 넣지 않으며 기기 토큰과 설치 인증 비밀값은 서버/앱 내부에만 저장합니다.

## 설치와 알림 켜기

1. 휴대폰에서 [APK 다운로드](https://tiffany-room.onrender.com/downloads/tiffany-room-android.apk)를 엽니다. Render가 최신 main 배포를 마쳐야 합니다.
2. 필요한 경우 해당 브라우저 또는 파일 앱에 ‘이 출처의 앱 설치 허용’을 켜서 설치합니다. Play Protect 같은 보안 검사는 끄지 마세요. 설치 후 출처별 허용은 다시 끌 수 있습니다.
3. 앱 **맨 위의 ‘알림 설정’ → 알림 켜기**를 선택합니다. Android 13 이상에서는 알림 권한도 허용해야 합니다. 사이트 안의 브라우저 알림 버튼과는 별개입니다.
4. Firebase 설정이 빠졌으면 연결 대기 안내가 나옵니다. 서버 설정을 완료한 후 앱 알림을 껐다가 다시 켭니다.
5. ‘테스트 알림’은 등록된 이 기기에 서버가 실제 FCM 푸시를 보내는 기능이며 1분에 한 번 요청할 수 있습니다. 성공 메시지만으로 도착을 보장하지 않으므로 휴대폰의 알림 도착까지 확인하세요.

알림을 누르면 SOOP 또는 YouTube가 열립니다. 잠금 해제·방송 강제 실행·다른 앱 위에 표시하기는 수행하지 않습니다. 서버 첫 정상 조회는 기준점이므로 이미 진행 중인 방송과 기존 영상을 새 알림으로 보내지 않습니다. 유튜브는 공개 RSS 최신 12개 범위에서 감지합니다. 앱을 강제 종료하면 다시 앱을 열기 전까지 푸시가 중단될 수 있습니다.

## 데이터와 권한

앱은 사이트의 HTTPS 화면과 공개 Firebase 연결 설정을 읽습니다. 사용자가 앱 알림을 켜면 Firebase 기기 토큰을 받아 티파니룸 서버에 등록합니다. 서버는 알림 대상 토큰과 인증값의 해시를 영구 저장합니다. 앱은 등록 인증값을 앱 내부 저장소에 보관합니다. 알림을 끄면 기기 등록 해제와 FCM 토큰 삭제를 시도합니다. 네트워크 오류로 해제가 지연되더라도 앱은 수신 알림 표시를 중단합니다. 앱 삭제 후 서버에 남은 무효 토큰은 FCM의 UNREGISTERED 응답으로 정리합니다.

외부 링크는 지정한 SOOP/YouTube HTTPS 호스트만 엽니다. 파일 URL·임의 intent·평문 HTTP·JavaScript 네이티브 브리지는 허용하지 않습니다. 봇 토큰·AI 키·Firebase 서버 비밀키는 APK에 포함하지 않습니다. 연락처·전체 파일·위치·마이크·카메라·절전 해제·전체 화면 실행 권한을 요청하지 않습니다. Google Play 서비스 및 Firebase SDK는 푸시 전달을 위해 기기 등록 정보를 Google에 전송합니다. Firebase 정책과 개인정보 안내를 별도로 검토해야 합니다.

현재 기기 등록 API는 공개 소규모 사이트용이며 계정별 권한이나 App Check는 구현하지 않았습니다. 대규모 공개 서비스에는 App Check, 등록 제한·비용 통제, 개인정보 고지 및 삭제 정책을 추가해야 합니다.

## 빌드

Android Studio에서 `android/`를 엽니다. AGP 8.9.2 / Gradle 8.11.1 / JDK 17+ / SDK 35 / 최소 SDK 26을 사용합니다. Java 컴파일 대상은 17입니다. Firebase SDK 버전은 `com.google.firebase:firebase-messaging:24.1.1`로 고정했습니다. 검증된 Gradle 8.11.1 wrapper와 배포 체크섬을 저장소에 포함합니다.

```sh
cd android
./gradlew :app:assemblePushDebug
```

FCM 앱 연결 설정은 서버에서 받아 초기화하므로 `google-services.json`을 APK 빌드에 넣을 필요는 없습니다. 개발자는 예측 가능한 동일 프로젝트에서 서버/앱을 운영해야 합니다.

`preview` flavor와 `build-apk.sh`는 Firebase 없는 예비 폴링판이며 **백그라운드 최소 15분**입니다. 배포용으로 이 버전을 대신 사용하지 마세요. `PushSupport`가 FCM 버전을 확인하면 기기 폴링/정기 작업은 중단됩니다. 앱용 라이브러리는 Gradle이 공식 Google/Maven 저장소에서 받으며 TLS 검증을 유지합니다.

APK 공개 경로는 `android/releases/tiffany-room-android.apk`, SHA-256은 같은 폴더의 `.apk.sha256`입니다. 현재 테스트 키는 Git에 저장하지 않습니다. 동일 서명 키가 없으면 기존 APK 위에 업데이트할 수 없어 삭제·재설치해야 하고 로컬 설정이 지워집니다. 정식 배포에는 안전하게 관리한 릴리스 키와 버전 관리가 필요합니다.

## 검증 범위

알림 감지 알고리즘의 JVM 검사 10개, 서버의 Firebase JWT 서명·토큰 캐시·메시지 형식·기기 인증·등록 해제·채널별 재시도 및 기존 웹 통합 테스트를 실행합니다. APK 빌드·서명 검증과 실제 휴대폰의 설치·화면·권한·백그라운드 수신 검증은 구별해서 보고해야 합니다. Firebase 프로젝트가 연결되기 전의 모의 테스트 통과는 실제 푸시 성공을 의미하지 않습니다.
