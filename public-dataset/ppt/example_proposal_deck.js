/**
 * business-docs/references/지난제안서.md  ->  발표 덱
 * 디자인: ictk_deck_template.pptx (스펙은 ictk_deck_template.DESIGN.md)
 *
 * 실행:
 *   npm i pptxgenjs
 *   node example_proposal_deck.js      -> example_proposal_deck.pptx
 *
 * 설계 단위는 px(1920x1080). PptxGenJS는 inch를 받으므로 px/96,
 * 폰트는 px*0.75 = pt 로 옮긴다. 원본 템플릿이 그렇게 만들어졌다.
 */

const pptxgen = require('pptxgenjs');

/* ── 스펙 상수 : ictk_deck_template.DESIGN.md 에서 그대로 옮김 ───────── */

const C = {
  deepNavy:  '070824',  // 전면 메시지 배경
  navy:      '0B2E6B',  // 결론 패널, 표 헤더
  blue:      '1E5BD6',  // 강조 - 자사/핵심 수치
  cyan:      '35D6E8',  // 보조 강조
  hlBg:      'F0F5FF',  // 강조 열 셀 배경
  panelBg:   'F3F6FC',  // 카드 배경
  panelBg2:  'DCE4F1',  // 카드 배경 (진한 쪽)
  text:      '101828',
  text2:     '3F4A5F',
  text3:     '5A6478',
  muted:     '94A0B5',
  white:     'FFFFFF',
};

// pt (= px * 0.75)
const T = {
  cover:  84,   // 112px  표지 제목
  hero:   78,   // 104px  전면 메시지
  close:  66,   //  88px  클로징
  metric: 48,   //  64px  핵심 수치
  title:  39,   //  52px  슬라이드 제목
  conc: 34.5,   //  46px  패널 결론
  sub:    30,   //  40px  표지 부제
  prem: 25.5,   //  34px  패널 전제
  lead:   24,   //  32px  그룹 제목
  kick: 22.5,   //  30px  킥커(한 줄 요약)
  body:   21,   //  28px  본문
  body2:19.5,   //  26px  본문/라벨
  cell:18.75,   //  25px  표 셀
  cap:    18,   //  24px  캡션/출처/푸터
};

// inch
const G = {
  W: 20, H: 11.25,
  m: 1.15,            // 좌우 여백 (110px)
  contentW: 17.71,    // 20 - 1.15*2 (반올림 오차는 원본 값 그대로)
  titleY: 0.83,       // 제목 (80px)
  kickY: 1.62,        // 킥커
  ruleY: 2.35,        // 구분선
  bodyY: 2.90,        // 콘텐츠 시작
  footY: 10.22,       // 푸터
  numX: 18.47,        // 우상단 섹션 번호
  pageX: 18.58,       // 우하단 페이지 번호
  panelX: 10.29,      // 우측 네이비 패널
  panelW: 8.56,
};

const FONT = 'Pretendard';   // 원본 Style Guide의 선언 폰트.
                             // 미설치 환경에서는 Noto Sans KR 로 바꿔도 좌표는 그대로다.

// 큰 글자만 자간을 좁힌다 (원본: 39pt 이상 -2 ~ -3.5%)
const track = (pt, pct) => +(pt * pct / 100).toFixed(2);

/* ── 공통 골격 ──────────────────────────────────────────────────────
 * 본문 슬라이드는 전부 같은 뼈대를 쓴다. 원본도 이렇게 만들어졌고,
 * 슬라이드마다 다시 그리면 y좌표가 조금씩 어긋난다.
 */
function chrome(slide, { title, kicker, num, chapter, page, dark = false }) {
  const fg   = dark ? C.white : C.text;
  const fg2  = dark ? C.panelBg2 : C.text3;
  const line = dark ? '2A3550' : C.panelBg2;

  slide.addText(title, {
    x: G.m, y: G.titleY, w: 12, h: 0.69,
    fontFace: FONT, fontSize: T.title, bold: true,
    color: fg, charSpacing: track(T.title, -2),
  });

  if (kicker) {
    slide.addText(kicker, {
      x: G.m, y: G.kickY, w: 13.5, h: 0.5,
      fontFace: FONT, fontSize: T.kick, color: fg2,
    });
  }

  if (num) {
    slide.addText(num, {
      x: G.numX, y: G.titleY, w: 0.47, h: 0.43,
      fontFace: FONT, fontSize: T.body2, bold: true,
      color: C.blue, align: 'right',
    });
  }

  slide.addShape('rect', {
    x: G.m, y: G.ruleY, w: G.contentW, h: 0.04,
    fill: { color: line },
  });

  slide.addText(chapter, {
    x: G.m, y: G.footY, w: 8, h: 0.41,
    fontFace: FONT, fontSize: T.cap, color: dark ? C.muted : C.muted,
  });

  slide.addText(String(page), {
    x: G.pageX, y: G.footY, w: 0.36, h: 0.41,
    fontFace: FONT, fontSize: T.cap, color: C.muted, align: 'right',
  });
}

/* 우측 네이비 패널 — 전제 한 줄, 헤어라인, 결론 한 줄.
 * 이 덱의 핵심 규칙: 왼쪽은 근거, 오른쪽은 결론 하나. */
function panel(slide, { premise, conclusion, y = G.bodyY, h = 6.87 }) {
  slide.addShape('rect', {
    x: G.panelX, y, w: G.panelW, h,
    fill: { color: C.navy },
  });
  slide.addText(premise, {
    x: G.panelX + 0.58, y: y + 1.9, w: G.panelW - 1.16, h: 1.10,
    fontFace: FONT, fontSize: T.prem, color: C.panelBg2,
    lineSpacingMultiple: 1.35, valign: 'top',
  });
  slide.addShape('rect', {
    x: G.panelX + 0.58, y: y + 3.3, w: G.panelW - 1.74, h: 0.02,
    fill: { color: C.cyan },
  });
  slide.addText(conclusion, {
    x: G.panelX + 0.58, y: y + 3.65, w: G.panelW - 1.16, h: 1.9,
    fontFace: FONT, fontSize: T.conc, bold: true, color: C.white,
    charSpacing: track(T.conc, -2), lineSpacingMultiple: 1.25, valign: 'top',
  });
}

/* 카드 — 4.17 x 2.61, 배경 F3F6FC, 간격 0.22 (원본 실측값) */
function card(slide, { x, y, label, title, body, w = 4.17, h = 2.61 }) {
  slide.addShape('rect', { x, y, w, h, fill: { color: C.panelBg } });
  slide.addShape('rect', { x, y, w: 0.05, h, fill: { color: C.blue } });
  slide.addText(label, {
    x: x + 0.33, y: y + 0.30, w: w - 0.66, h: 0.43,
    fontFace: FONT, fontSize: T.body2, bold: true, color: C.blue,
  });
  slide.addText(title, {
    x: x + 0.33, y: y + 0.80, w: w - 0.66, h: 0.46,
    fontFace: FONT, fontSize: T.body, bold: true, color: C.text,
  });
  slide.addText(body, {
    x: x + 0.33, y: y + 1.34, w: w - 0.66, h: 1.0,
    fontFace: FONT, fontSize: T.cap, color: C.text3,
    lineSpacingMultiple: 1.4, valign: 'top',
  });
}

/* 표 — 스킬 규칙에 따라 네이티브 addTable().
 * 원본 템플릿은 표를 도형으로 그렸지만, 표 데이터는 표로 넣어야
 * PowerPoint에서 편집이 된다. 색·행높이만 원본에 맞춘다. */
function table(slide, headers, rows, opts = {}) {
  const head = headers.map((h, i) => ({
    text: h,
    options: {
      fontFace: FONT, fontSize: T.body2, bold: true,
      color: C.white,
      fill: { color: i === headers.length - 1 && opts.highlightLast ? C.blue : C.navy },
      align: i === 0 ? 'left' : 'center', valign: 'middle',
    },
  }));

  const body = rows.map((row, r) =>
    row.map((cellText, i) => {
      const isLast = i === headers.length - 1;
      const isTotal = opts.totalRow && r === rows.length - 1;
      return {
        text: cellText,
        options: {
          fontFace: FONT, fontSize: T.cell,
          bold: isTotal || (isLast && opts.highlightLast),
          color: isTotal ? C.text : C.text2,
          fill: {
            color: isTotal ? C.panelBg2
                 : isLast && opts.highlightLast ? C.hlBg
                 : C.white,
          },
          align: i === 0 ? 'left' : 'center',
          valign: 'middle',
        },
      };
    })
  );

  slide.addTable([head, ...body], {
    x: G.m, y: opts.y || G.bodyY, w: opts.w || G.contentW,
    colW: opts.colW,
    rowH: [0.62, ...rows.map(() => opts.rowH || 0.62)],
    border: { type: 'solid', pt: 0.5, color: C.panelBg2 },
    margin: [6, 12, 6, 12],
    autoPage: false,
  });
}

/* ── 덱 조립 ────────────────────────────────────────────────────── */

const pptx = new pptxgen();
pptx.defineLayout({ name: 'W1920', width: G.W, height: G.H });
pptx.layout = 'W1920';
pptx.author = 'DataPopcorn';
pptx.title = '스마트미터 보안칩 적용 제안';

const CH = {
  bg:   '01. 제안 배경과 현황',
  sol:  '02. 제안 내용',
  plan: '03. 도입 절차와 일정',
  cost: '04. 투자 비용과 기대 효과',
  co:   '05. 회사 소개',
};

/* 1 — 표지 */
{
  const s = pptx.addSlide();
  s.addShape('rect', { x: 0, y: 0, w: G.W, h: G.H, fill: { color: C.deepNavy } });
  // 원본 표지는 제목 1줄(84pt) 기준이다. 여기는 2줄이라 한 단 낮춘 78pt를 쓰고
  // 부제·사명 y를 그만큼 내렸다. 폭 9.0in에 78pt 8자가 들어간다.
  s.addShape('rect', { x: 10.0, y: 3.40, w: 0.92, h: 0.05, fill: { color: C.cyan } });
  s.addText('스마트미터\n보안칩 적용 제안', {
    x: 10.0, y: 3.85, w: 9.0, h: 2.60,
    fontFace: FONT, fontSize: T.hero, bold: true, color: C.white,
    charSpacing: track(T.hero, -3.5), lineSpacingMultiple: 1.12,
    valign: 'top',
  });
  s.addText('대한전력계량 주식회사 구매팀 · 2026. 03. 12', {
    x: 10.0, y: 6.75, w: 9.0, h: 0.65,
    fontFace: FONT, fontSize: T.sub, color: C.panelBg2, valign: 'top',
  });
  s.addText('주식회사 세이프칩 · SAFECHIP Co., Ltd.   |   문서번호 SC-PRO-2026-014', {
    x: 10.0, y: 7.75, w: 9.62, h: 0.46,   // 원본 표지 텍스트 폭
    fontFace: FONT, fontSize: T.body, color: C.muted, valign: 'top',
  });
  s.addNotes('표지. 제출처와 제출일을 먼저 확인시키고 시작한다. 문서번호는 구매팀 접수 기준.');
}

/* 2 — 목차 */
{
  const s = pptx.addSlide();
  chrome(s, { title: 'Contents', kicker: '', chapter: '', page: 2 });
  const items = [
    ['01', '제안 배경과 현황', '2027년 보안 요구사항과 현재 방식의 한계'],
    ['02', '제안 내용', 'SC-100 · SafeManager · 라인 적용 컨설팅'],
    ['03', '도입 절차와 일정', '4단계 21주, 2026년 10월 양산 개시'],
    ['04', '투자 비용과 기대 효과', '초도 2억 6,500만 원, 유출 경로 1개 제거'],
    ['05', '회사 소개', '설립 2009, 누적 320만 개 공급'],
  ];
  items.forEach(([no, title, desc], i) => {
    const y = G.bodyY + 0.30 + i * 1.42;
    s.addText(no, {
      x: G.m, y, w: 1.2, h: 0.69,
      fontFace: FONT, fontSize: T.title, bold: true, color: C.blue,
      charSpacing: track(T.title, -2),
    });
    s.addText(title, {
      x: G.m + 1.5, y, w: 9.0, h: 0.69,
      fontFace: FONT, fontSize: T.title, bold: true, color: C.text,
      charSpacing: track(T.title, -2),
    });
    s.addText(desc, {
      x: G.m + 1.5, y: y + 0.72, w: 12.0, h: 0.46,
      fontFace: FONT, fontSize: T.body, color: C.text3,
    });
    s.addShape('rect', {
      x: G.m, y: y + 1.20, w: G.contentW, h: 0.01, fill: { color: C.panelBg2 },
    });
  });
  s.addNotes('목차. 5개 묶음으로 재구성했다 — 원문 9개 절을 그대로 읽지 않는다.');
}

/* 3 — 1절 제안 배경 : 레이아웃 A (좌 근거 / 우 결론) */
{
  const s = pptx.addSlide();
  chrome(s, {
    title: '제안 배경',
    kicker: '2027년부터 스마트미터 전량에 기기별 고유 인증이 의무화됩니다',
    num: '01', chapter: CH.bg, page: 3,
  });
  s.addText('현재 방식(공장에서 열쇠 파일 생성 → 기기 메모리 주입)의 문제', {
    x: G.m, y: G.bodyY, w: 9.42, h: 0.53,
    fontFace: FONT, fontSize: T.lead, bold: true, color: C.text,
  });
  card(s, {
    x: G.m, y: 3.70, label: '문제 01', title: '열쇠 파일 유출 위험',
    body: '열쇠 파일이 공장 서버에 그대로 남는다. 서버가 뚫리면 해당 모델 전량이 함께 노출된다.',
  });
  card(s, {
    x: G.m + 4.39, y: 3.70, label: '문제 02', title: '폐기 이력 미기록',
    body: '기기 폐기 시 인증서를 무효화하는 절차가 기록으로 남지 않아 감사 대응이 어렵다.',
  });
  s.addText('근거 · 2025년 개정 계량기 보안 요구사항 / 연간 생산 물량 약 42만 대', {
    x: G.m, y: 6.70, w: 9.42, h: 0.40,
    fontFace: FONT, fontSize: T.cap, color: C.muted,
  });
  panel(s, {
    premise: '두 문제 모두 열쇠를 기기 바깥에서 만들기 때문에 생깁니다.',
    conclusion: '열쇠를 칩 안에서 만들면\n두 문제가 함께 사라집니다',
  });
  s.addNotes('레이아웃 A. 좌측 카드 2장이 원문 1절의 문제 두 가지. 우측 패널 결론이 이 발표의 논지 전체다.');
}

/* 4 — 2절 현황 분석 : 레이아웃 E (비교표) */
{
  const s = pptx.addSlide();
  chrome(s, {
    title: '현황 분석',
    kicker: '4개 항목 중 3개가 요구 수준에 미달합니다',
    num: '02', chapter: CH.bg, page: 4,
  });
  table(s,
    ['항목', '현재', '요구 수준', '충족 여부'],
    [
      ['기기별 고유 인증', '없음 (모델 단위 공용 열쇠)', '기기 1대당 1개', '미달'],
      ['열쇠 보관 위치', '공장 서버', '기기 내부', '미달'],
      ['인증서 회수 절차', '수기 관리', '시스템 기록', '미달'],
      ['연간 생산 물량', '약 42만 대', '동일', '해당 없음'],
    ],
    { colW: [4.8, 5.2, 4.5, 3.21], rowH: 0.86, highlightLast: true }
  );
  s.addText('출처 · 대한전력계량 제공 현황 자료, 2026. 02', {
    x: G.m, y: 7.60, w: 10, h: 0.41,
    fontFace: FONT, fontSize: T.cap, color: C.muted,
  });
  s.addNotes('레이아웃 E. 원문 2절 표에 "충족 여부" 열을 더했다 — 표만 옮기면 무엇이 문제인지가 안 보인다.');
}

/* 5 — 3절 제안 내용 : 레이아웃 B (병렬 3항목) */
{
  const s = pptx.addSlide();
  chrome(s, {
    title: '제안 내용',
    kicker: '칩 · 소프트웨어 · 라인 적용을 한 묶음으로 제공합니다',
    num: '03', chapter: CH.sol, page: 5,
  });
  const items = [
    ['3-1', '보안칩 SC-100', '기기마다 다른 고유값을 칩 안에서 직접 생성합니다.',
     '열쇠 파일을 외부에 두지 않으므로 공장 서버 유출 위험이 사라집니다.'],
    ['3-2', 'SafeManager 연동', '발급한 인증서를 한 화면에서 조회하고 무효화합니다.',
     '폐기 기기의 무효화 이력은 5년간 보관됩니다.'],
    ['3-3', '생산 라인 컨설팅', '기존 조립 라인에 칩 삽입 공정을 넣습니다.',
     '회로 변경안과 시험 항목을 함께 설계합니다.'],
  ];
  const w = 5.67, gap = 0.35;
  items.forEach(([no, title, lead, body], i) => {
    const x = G.m + i * (w + gap);
    s.addShape('rect', { x, y: G.bodyY, w, h: 0.08, fill: { color: i === 0 ? C.blue : C.panelBg2 } });
    s.addText(no, {
      x, y: G.bodyY + 0.35, w, h: 0.43,
      fontFace: FONT, fontSize: T.body2, bold: true, color: C.blue,
    });
    s.addText(title, {
      x, y: G.bodyY + 0.90, w, h: 0.60,
      fontFace: FONT, fontSize: T.lead, bold: true, color: C.text,
    });
    s.addText(lead, {
      x, y: G.bodyY + 1.70, w, h: 1.0,
      fontFace: FONT, fontSize: T.body, color: C.text2, lineSpacingMultiple: 1.4, valign: 'top',
    });
    s.addText(body, {
      x, y: G.bodyY + 2.85, w, h: 1.2,
      fontFace: FONT, fontSize: T.body2, color: C.text3, lineSpacingMultiple: 1.4, valign: 'top',
    });
  });
  s.addShape('rect', { x: G.m, y: 7.60, w: G.contentW, h: 0.01, fill: { color: C.panelBg2 } });
  s.addText('세 갈래를 따로 도입하면 인증서 이력이 끊깁니다. 함께 적용해야 감사 대응까지 닫힙니다.', {
    x: G.m, y: 7.85, w: G.contentW, h: 0.51,
    fontFace: FONT, fontSize: T.body, bold: true, color: C.text,
  });
  s.addNotes('레이아웃 B. 첫 칸(SC-100)이 대표 항목이라 상단 보더만 블루. 하단 한 줄이 "왜 묶음인가"에 대한 답이다.');
}

/* 6 — 4절 도입 절차 : 단계 표 */
{
  const s = pptx.addSlide();
  chrome(s, {
    title: '도입 절차',
    kicker: '4단계 21주. 고객 준비 사항은 단계마다 미리 확정합니다',
    num: '04', chapter: CH.plan, page: 6,
  });
  table(s,
    ['단계', '기간', '주요 활동', '고객 준비 사항'],
    [
      ['1. 사전 검토', '3주', '현재 회로도 검토, 적용 범위 확정', '회로도 · 생산 공정도 제공'],
      ['2. 시제품 제작', '6주', '보안칩 적용 시제품 20대 제작', '시제품용 자재 제공'],
      ['3. 시험', '4주', '동작 시험, 보안 요구사항 적합성 확인', '시험 설비 사용 협조'],
      ['4. 양산 적용', '8주', '라인 세팅, 초도 물량 생산', '라인 정지 일정 조율'],
    ],
    { colW: [3.6, 2.0, 6.6, 5.51], rowH: 0.86 }
  );
  s.addText('고객 준비 사항이 늦어지면 전체 일정이 그만큼 밀립니다. 1단계 자료는 계약 후 1주 안에 필요합니다.', {
    x: G.m, y: 7.60, w: G.contentW, h: 0.51,
    fontFace: FONT, fontSize: T.body, bold: true, color: C.text,
  });
  s.addNotes('원문 4절 표. 표 데이터라 네이티브 표로 넣었다. 하단 한 줄은 원문에 없지만 발표에서 반드시 짚어야 하는 리스크.');
}

/* 7 — 5절 일정 : 레이아웃 C (타임라인 + 수치 패널) */
{
  const s = pptx.addSlide();
  chrome(s, {
    title: '일정',
    kicker: '계약 체결 후 약 6개월 만에 양산에 들어갑니다',
    num: '05', chapter: CH.plan, page: 7,
  });
  const marks = [
    ['2026. 04. 30', '계약 체결'],
    ['2026. 07. 10', '시제품 완료'],
    ['2026. 08. 14', '시험 완료'],
    ['2026. 10. 20', '양산 개시'],
  ];
  s.addShape('rect', { x: G.m, y: G.bodyY + 0.30, w: 0.05, h: 4.6, fill: { color: C.panelBg2 } });
  marks.forEach(([date, label], i) => {
    const y = G.bodyY + 0.30 + i * 1.20;
    s.addShape('ellipse', {
      x: G.m - 0.09, y: y + 0.16, w: 0.23, h: 0.23,
      fill: { color: i === marks.length - 1 ? C.blue : C.muted },
    });
    s.addText(date, {
      x: G.m + 0.50, y, w: 3.2, h: 0.60,
      fontFace: FONT, fontSize: T.body, bold: true,
      color: i === marks.length - 1 ? C.blue : C.text,
    });
    s.addText(label, {
      x: G.m + 3.90, y: y + 0.04, w: 4.4, h: 0.52,
      fontFace: FONT, fontSize: T.body, color: C.text2,
    });
  });
  s.addText('시험 완료(8/14)와 양산 개시(10/20) 사이 9주가 라인 세팅 기간입니다.', {
    x: G.m, y: 8.10, w: 9.0, h: 0.51,
    fontFace: FONT, fontSize: T.body2, color: C.text3,
  });

  s.addShape('rect', { x: G.panelX, y: G.bodyY, w: G.panelW, h: 6.87, fill: { color: C.navy } });
  s.addText('계약 → 양산', {
    x: G.panelX + 0.58, y: 4.48, w: G.panelW - 1.16, h: 0.46,
    fontFace: FONT, fontSize: T.body, color: C.panelBg2,
  });
  s.addText('약 6개월', {
    x: G.panelX + 0.58, y: 5.10, w: G.panelW - 1.16, h: 0.90,
    fontFace: FONT, fontSize: T.metric, bold: true, color: C.white,
    charSpacing: track(T.metric, -2.5),
  });
  s.addText('2026. 04. 30  →  2026. 10. 20', {
    x: G.panelX + 0.58, y: 6.10, w: G.panelW - 1.16, h: 0.46,
    fontFace: FONT, fontSize: T.body, color: C.cyan,
  });
  s.addShape('rect', { x: G.panelX + 0.58, y: 6.80, w: G.panelW - 1.74, h: 0.02, fill: { color: C.cyan } });
  s.addText('2027년 요구사항 시행 전에 초도 물량을 확보하려면 4월 계약이 마지노선입니다.', {
    x: G.panelX + 0.58, y: 7.10, w: G.panelW - 1.16, h: 1.0,
    fontFace: FONT, fontSize: T.body2, color: C.panelBg2, lineSpacingMultiple: 1.4, valign: 'top',
  });
  s.addNotes('레이아웃 C. 우측 패널 수치 48pt는 이 슬라이드에서 하나만 쓴다. 마지막 마일스톤만 블루로 강조.');
}

/* 8 — 6절 투자 비용 : 표 + 금액 패널 */
{
  const s = pptx.addSlide();
  chrome(s, {
    title: '투자 비용',
    kicker: '초도 물량 기준 2억 6,500만 원입니다 (부가세 별도)',
    num: '06', chapter: CH.cost, page: 8,
  });
  table(s,
    ['항목', '수량', '단가', '금액'],
    [
      ['보안칩 SC-100 (초도)', '100,000개', '1,850원', '185,000,000원'],
      ['SafeManager 라이선스 (3년)', '1식', '48,000,000원', '48,000,000원'],
      ['적용 컨설팅', '1식', '32,000,000원', '32,000,000원'],
      ['합계 (부가세 별도)', '', '', '265,000,000원'],
    ],
    { colW: [4.2, 2.0, 2.4, 3.0], w: 11.6, rowH: 0.80, totalRow: true }
  );
  s.addText('2년차부터 보안칩 단가는 물량에 따라 재협의합니다.', {
    x: G.m, y: 7.35, w: 11.6, h: 0.41,
    fontFace: FONT, fontSize: T.cap, color: C.muted,
  });

  s.addShape('rect', { x: 13.5, y: G.bodyY, w: 5.35, h: 4.5, fill: { color: C.navy } });
  s.addText('초도 도입 총액', {
    x: 14.0, y: G.bodyY + 0.90, w: 4.35, h: 0.46,
    fontFace: FONT, fontSize: T.body, color: C.panelBg2,
  });
  s.addText('2.65억 원', {
    x: 14.0, y: G.bodyY + 1.50, w: 4.35, h: 0.90,
    fontFace: FONT, fontSize: T.metric, bold: true, color: C.white,
    charSpacing: track(T.metric, -2.5),
  });
  s.addText('기기 1대당 약 631원', {
    x: 14.0, y: G.bodyY + 2.55, w: 4.35, h: 0.46,
    fontFace: FONT, fontSize: T.body, color: C.cyan,
  });
  s.addText('연간 42만 대 기준으로 환산한 값입니다.', {
    x: 14.0, y: G.bodyY + 3.15, w: 4.35, h: 0.80,
    fontFace: FONT, fontSize: T.cap, color: C.muted, lineSpacingMultiple: 1.4, valign: 'top',
  });
  s.addNotes('원문 6절 표 그대로. 우측 환산값(1대당 631원)은 총액 265,000,000 / 420,000 을 발표용으로 덧붙인 것.');
}

/* 9 — 7절 기대 효과 : 레이아웃 F (첫 칸 대표) */
{
  const s = pptx.addSlide();
  chrome(s, {
    title: '기대 효과',
    kicker: '유출 경로 하나를 없애고, 감사 대응 시간을 3일에서 반나절로 줄입니다',
    num: '07', chapter: CH.cost, page: 9,
  });
  const effects = [
    ['대표 효과', '유출 경로 1개 제거', '열쇠 파일 외부 보관이 사라져 공장 서버를 통한 유출 경로가 없어집니다.', true],
    ['효과 02', '감사 대응 3일 → 반나절', '인증서 회수 이력이 자동 기록되어 자료를 모으는 시간이 줄어듭니다.', false],
    ['효과 03', '2027년 요구사항 충족', '기기별 고유 인증 의무화 조항을 양산 시점에 맞춰 충족합니다.', false],
  ];
  const w = 5.67, gap = 0.35;
  effects.forEach(([label, title, body, lead], i) => {
    const x = G.m + i * (w + gap);
    s.addShape('rect', {
      x, y: G.bodyY, w, h: 4.6,
      fill: { color: lead ? C.navy : C.panelBg },
    });
    s.addText(label, {
      x: x + 0.40, y: G.bodyY + 0.45, w: w - 0.80, h: 0.43,
      fontFace: FONT, fontSize: T.body2, bold: true,
      color: lead ? C.cyan : C.blue,
    });
    s.addText(title, {
      x: x + 0.40, y: G.bodyY + 1.05, w: w - 0.80, h: 1.10,
      fontFace: FONT, fontSize: T.lead, bold: true,
      color: lead ? C.white : C.text, lineSpacingMultiple: 1.25, valign: 'top',
    });
    s.addText(body, {
      x: x + 0.40, y: G.bodyY + 2.45, w: w - 0.80, h: 1.6,
      fontFace: FONT, fontSize: T.body2,
      color: lead ? C.panelBg2 : C.text3, lineSpacingMultiple: 1.45, valign: 'top',
    });
  });
  s.addNotes('레이아웃 F. 첫 칸만 네이비 — 세 효과가 동급이 아니라는 뜻이다. 원문 7절은 나열이지만 발표는 우선순위를 정해야 한다.');
}

/* 10 — 8절 회사 소개 : 레이아웃 I */
{
  const s = pptx.addSlide();
  chrome(s, {
    title: '회사 소개',
    kicker: '2009년 설립, 스마트미터 제조사 4곳에 누적 320만 개를 공급했습니다',
    num: '08', chapter: CH.co, page: 10,
  });
  const rows = [
    ['설립', '2009년'],
    ['사업 영역', '보안 반도체 설계 · 공급'],
    ['공급 실적', '국내 스마트미터 제조사 4곳, 누적 320만 개'],
    ['보유 인증', 'CC EAL4+'],
  ];
  rows.forEach(([k, v], i) => {
    const y = G.bodyY + 0.35 + i * 1.15;
    s.addText(k, {
      x: G.m, y, w: 2.6, h: 0.46,
      fontFace: FONT, fontSize: T.body, bold: true, color: C.blue,
    });
    s.addText(v, {
      x: G.m + 3.0, y, w: 6.0, h: 0.46,
      fontFace: FONT, fontSize: T.body, color: C.text,
    });
    s.addShape('rect', { x: G.m, y: y + 0.72, w: 9.0, h: 0.01, fill: { color: C.panelBg2 } });
  });
  panel(s, {
    premise: '스마트미터 라인에 보안칩을 넣어 본 회사가 국내에 많지 않습니다.',
    conclusion: '같은 공정을 4곳에서\n이미 통과했습니다',
  });
  s.addNotes('레이아웃 I. 실적 숫자(320만 개, 4곳)가 이 슬라이드의 근거. CC EAL4+는 질문이 나오면 상세히.');
}

/* 11 — 9절 문의처 : 클로징 */
{
  const s = pptx.addSlide();
  s.addShape('rect', { x: 0, y: 0, w: G.W, h: G.H, fill: { color: C.deepNavy } });
  s.addText('Secure by design', {
    x: 0, y: 4.30, w: G.W, h: 1.14,
    fontFace: FONT, fontSize: T.close, bold: true, color: C.white,
    charSpacing: track(T.close, -3), align: 'center',
  });
  s.addShape('rect', { x: 9.37, y: 5.85, w: 1.25, h: 0.04, fill: { color: C.cyan } });
  s.addText('영업 담당  김민준 과장   010-0000-0000   minjun.kim@safechip.example.com', {
    x: 0, y: 6.35, w: G.W, h: 0.49,
    fontFace: FONT, fontSize: T.kick, color: C.panelBg2, align: 'center',
  });
  s.addText('기술 담당  이서연 책임   seoyeon.lee@safechip.example.com', {
    x: 0, y: 6.95, w: G.W, h: 0.49,
    fontFace: FONT, fontSize: T.kick, color: C.panelBg2, align: 'center',
  });
  s.addText('주식회사 세이프칩   |   문서번호 SC-PRO-2026-014', {
    x: 0, y: 8.00, w: G.W, h: 0.41,
    fontFace: FONT, fontSize: T.cap, color: C.muted, align: 'center',
  });
  s.addNotes('클로징. 원본 템플릿의 "Safe with us" 자리. 담당자 두 명을 함께 띄워 두고 질의응답으로 넘어간다.');
}

pptx.writeFile({ fileName: 'example_proposal_deck.pptx' })
  .then(() => console.log('example_proposal_deck.pptx 생성 완료 — 11 슬라이드'));
