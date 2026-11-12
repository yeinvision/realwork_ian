# 이안의 일잘러 노트

리얼워크에서 일과 성장을 관리하는 개인용 웹앱이에요.

- 오늘: One Thing, 우선순위 3가지, 할 일, 출퇴근(예상 퇴근 시간), 필수 기록 · 하루 회고(아래 접기)
- 주간 일정: 7일 칸, 끌어서 다른 날로 옮기기, 우선순위(S/A/B/C) · 진행 상태 바로 바꾸기
- 메모: 빠른 메모, 카드(첫 줄 · 내용 · 날짜)로 모아 보기, 검색
- AI 연구소: 팀 AI 툴 링크를 썸네일 카드로 모아 두고 클릭해서 열기
- 캘린더 · 할 일(세부 항목) · 회의록 · 회고(일간/주간/월간) · 출퇴근 · 학습노트 · 설정
- 어두운/밝은 테마, 안드로이드 홈 화면 설치(PWA)

## 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 웹앱 전체 (화면, 기능, Supabase 연결) |
| `manifest.webmanifest`, `icon-*.png` | 휴대폰 홈 화면 설치용 앱 정보와 아이콘 |
| `sw.js` | 앱 화면 캐시 (오프라인에서도 열리게) |
| `vercel.json` | Vercel 배포 설정 |

## 데이터

- 로그인: Supabase Auth (이메일 로그인 링크)
- 저장: Supabase `public.notes` 테이블 (본인 기록만 읽고 쓰도록 RLS로 잠금)
- 일정 알림(웹 푸시): `push_subs`(알림 받을 기기) · `push_sent`(보낸 알림 기록) 테이블, `supabase/functions/push-reminders` 함수를 cron(`push-reminders`, 1분마다)이 불러요. VAPID 비밀 키와 `CRON_SECRET`은 Supabase secrets에만 있어요. 함수 수정 후 배포: `npx supabase functions deploy push-reminders --remote=zzkugatuxqqzxvbejysz --no-verify-jwt --use-api`
- `index.html` 안의 publishable key는 브라우저에 공개돼도 되는 키예요. secret key는 절대 이 저장소에 넣지 마세요.
