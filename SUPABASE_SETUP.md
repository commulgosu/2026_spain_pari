# Supabase 방명록 연결

1. Supabase에서 프로젝트를 만든 뒤 **SQL Editor**를 엽니다.
2. `supabase/guestbook.sql`의 내용을 붙여 넣고 실행합니다. 이 설정은 방문자에게 방명록 읽기와 새 글 추가만 허용합니다.
3. 프로젝트의 **Connect** 화면에서 Project URL과 **Publishable key**를 복사합니다. Secret key 또는 service_role 키는 사용하지 않습니다.
4. `site-config.json`의 `supabaseUrl`과 `supabasePublishableKey` 값을 각각 입력하고 GitHub의 `main` 브랜치에 올립니다.

방문자는 Supabase 계정 없이 방명록을 남길 수 있습니다. 공개 글쓰기이므로 입력 내용은 모두에게 보입니다. 무료 프로젝트는 사용량이 낮은 상태가 이어지면 자동으로 일시 중지될 수 있습니다.
