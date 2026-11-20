# 방문자 공지 기능 최초 설정

공지 내용은 공개 GitHub 저장소의 `notices.json`에 저장됩니다. 웹페이지에는 GitHub 토큰이나 Turnstile 비밀키를 넣지 않습니다. Cloudflare Worker에 두 비밀값을 등록해야 실제 게시가 시작됩니다. 데이터베이스는 사용하지 않습니다.

## 1. Cloudflare Turnstile 만들기

Cloudflare 대시보드에서 Turnstile 위젯을 만들고 허용 호스트에 `commulgosu.github.io`를 추가합니다. 제공된 Site key는 `worker/wrangler.toml`의 `TURNSTILE_SITE_KEY` 값에 넣습니다. Secret key는 다음 단계에서 Worker 비밀값으로 등록합니다.

## 2. GitHub 쓰기 토큰 만들기

GitHub에서 fine-grained personal access token을 만들고 저장소 `commulgosu/2026_spain_pari` 하나만 선택합니다. Repository permissions에서 **Contents: Read and write**만 허용합니다. 이 토큰은 Worker에만 보관하고 웹사이트 코드나 채팅에 붙여 넣지 마세요.

## 3. Worker 배포 및 비밀값 등록

컴퓨터에 Node.js가 설치된 상태에서 저장소 폴더의 PowerShell을 열고 다음 명령을 실행합니다.

```powershell
npx wrangler login
npx wrangler secret put GITHUB_TOKEN --config worker/wrangler.toml
npx wrangler secret put TURNSTILE_SECRET_KEY --config worker/wrangler.toml
npx wrangler deploy --config worker/wrangler.toml
```

각 `secret put` 명령이 입력을 요청하면 해당 비밀값을 터미널에 직접 붙여 넣습니다. 성공하면 Worker 주소가 표시됩니다. 보통 `https://spain-paris-notices.<계정>.workers.dev` 형식입니다.

## 4. 사이트에 Worker 주소 연결

`site-config.json`의 `noticesApiUrl`을 표시된 Worker 주소로 바꿉니다.

```json
{
  "noticesApiUrl": "https://spain-paris-notices.<계정>.workers.dev"
}
```

이 변경 파일을 GitHub의 `main` 브랜치에 올리면 배포 후 공지 탭에서 등록과 공개 조회가 활성화됩니다. 각 게시물은 GitHub 저장소에 새 커밋으로 남고, 사이트 화면의 공지 목록은 Pages 재배포를 기다리지 않고 Worker에서 바로 불러옵니다.

## 운영 참고

- 공지는 누구나 볼 수 있으며 최대 2,000건까지 파일에 보관됩니다.
- 작성자 입력은 선택 사항이며 신원을 인증하지 않습니다. 개인정보나 민감한 내용은 등록하지 않도록 화면에 안내합니다.
- Turnstile은 자동화된 게시를 줄여 주지만 방문자가 쓴 내용은 공개 즉시 보입니다.
- Worker 코드나 `site-config.json`에는 비밀키를 절대 넣지 않습니다.
