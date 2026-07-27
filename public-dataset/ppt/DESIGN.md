# creative_brief_deck.pptx 디자인 시스템

`creative_brief_deck.pptx`에서 실측해 뽑은 스펙. 이 문서만 있으면 원본 없이도 같은 디자인의 새 덱을 만들 수 있다.

수치는 전부 pptx XML에서 직접 읽은 값이다(단위 변환: EMU ÷ 914400 = inch, `sz` ÷ 100 = pt, `spc` ÷ 100 = pt). 눈대중으로 반올림한 값이 아니라, 재현 후 원본과 대조할 수 있는 기준값이다.

한 줄 요약: **검정 바탕에 빨강 하나, 초대형 볼드 산세리프, 사진은 잘라 붙인 블록.** 색과 폰트를 아끼고 크기 대비로만 위계를 만든다.

---

## 1. 캔버스와 그리드

| 항목 | 값 |
|---|---|
| 캔버스 | **20 × 11.25 inch** (18288000 × 10287000 EMU), 16:9 |
| 좌우 여백 | **1.12 inch** — 본문 슬라이드 기준선. 콘텐츠 폭 17.76 inch |
| 표지 여백 | 0.81 inch (표지만 더 넓게 씀) |
| 상단 기준선 | y = **1.08 ~ 1.20** — 섹션 번호·러닝헤더가 붙는 줄 |
| 하단 기준선 | y = **9.5 ~ 10.05** — 본문 꼬리말·연락처가 붙는 줄 |
| 사진 간격 | **0.90 inch** (slide7 2단 배치 기준) |

캔버스가 PowerPoint 기본 와이드(13.333 × 7.5 inch)가 **아니다**. 비율은 같지만 좌표계가 1.5배다. 새 덱을 만들 때 캔버스부터 20 × 11.25로 잡지 않으면 이 문서의 좌표를 그대로 쓸 수 없다.

```
python-pptx :  prs.slide_width  = Inches(20)
               prs.slide_height = Inches(11.25)
PptxGenJS   :  pptx.defineLayout({ name:'CANVA20', width:20, height:11.25 })
               pptx.layout = 'CANVA20'
```

## 2. 색

세 개가 전부다. 그레이 톤 없음, 그라디언트 없음.

| 역할 | HEX | 쓰는 곳 |
|---|---|---|
| 기본 | `#000000` | 텍스트 대부분, 표지 로고·이름 |
| 강조 | `#FF4937` | 섹션 전면 타이틀(SOCIAL MEDIA·DELIVERABLES·VISUAL STYLE), 해당 섹션 번호 |
| 바탕 | `#FFFFFF` | 배경, 사진 위 반전 텍스트 |

강조색은 장식이 아니라 **구획 신호**다. 새 섹션이 열리는 슬라이드의 대형 타이틀에만 빨강을 쓰고, 이어지는 본문 슬라이드는 검정으로 돌아온다. 슬라이드 5·7·8·9가 빨강, 나머지는 검정인 이유다.

`ppt/theme/theme1.xml`의 테마 색(accent1 `#4F81BD` 등)은 **Office 기본값이 그대로 남아 있고 이 디자인과 무관하다.** 테마에서 팔레트를 뽑으면 엉뚱한 파란색이 나온다.

## 3. 타이포그래피

### 폰트 3종

| 역할 | 폰트 | 대체안(한글 덱) |
|---|---|---|
| 디스플레이·본문 | **Pragmatica Bold** | Pretendard Bold / Archivo Black |
| 섹션 번호 전용 | **Berthold Block** | 굵은 슬랩·디도 계열, 없으면 Pretendard ExtraBold |
| 라벨·러닝헤더 | **Stavok Grotesque** Light / Bold | Pretendard Light / SemiBold |

셋 다 상용 폰트이고 `ppt/fonts/font16~19.fntdata`로 **파일에 임베드돼 있다**. 원본은 정상으로 보이지만, 새 덱에서 같은 폰트명만 지정하면 로컬에 없어 대체 폰트로 렌더된다. 재현 전에 대체 폰트를 먼저 정하고 시작한다.

### 크기 스케일

| pt | 폰트 | 역할 |
|---:|---|---|
| 195.43 | Pragmatica Bold | 전폭 타이틀 (DELIVERABLES, CONTACT US) |
| 174.29 | Pragmatica Bold | 표지 타이틀, 섹션 전면 타이틀 |
| 142.05 | Pragmatica Bold | 섹션 타이틀 (2단 조판) |
| 95 / 93 | Pragmatica Bold | 슬라이드 제목 |
| 77.57 | Pragmatica Bold | 목차 항목 |
| 58.46 | Berthold Block | 섹션 번호 (01~06) |
| 56 | Stavok Grotesque Light | 세로 회전 라벨 |
| 26.23 | Pragmatica Bold | 항목 라벨·값 (AGE: / 18-35 YEARS OLD) |
| 24 | Stavok Grotesque Bold | 러닝헤더 (BORCELLE STUDIO) |
| 19.44 / 17.28 | Pragmatica Bold | 연락처 |
| **15.99** | Pragmatica Bold | **본문 전부** |

본문이 16pt 하나로 고정이다. 20 inch 캔버스라 13.33 inch 기준으로 환산하면 약 10.7pt에 해당한다. 위계는 오직 디스플레이 크기(93~195pt)와 본문(16pt)의 **6~12배 대비**로 만든다. 중간 크기가 거의 없는 게 이 덱의 성격이다.

숫자가 195.43·174.29처럼 어중간한 건 Canva의 자동 맞춤이 스케일을 곱한 결과다. 재현할 때 195·174·142로 반올림해도 육안 차이는 없다.

### 자간 (letter-spacing)

크기보다 이쪽이 인상을 더 좌우한다. 폰트마다 비율이 다르다.

| 폰트 | `spc` 비율 | 예시 |
|---|---|---|
| Pragmatica Bold (디스플레이) | **-8.5%** | 174.29pt → `spc="-1481"` (-14.81pt) |
| Stavok Grotesque | **-13.7%** | 24pt → `spc="-328"` (-3.28pt) |
| Berthold Block (번호) | **-1.8%** | 58.46pt → `spc="-105"` (-1.05pt) |
| 본문 16pt | **0** | `spc` 속성 없음 |

디스플레이 텍스트를 자간 0으로 두면 원본과 전혀 다르게 벌어져 보인다. 재현 시 이 세 비율을 먼저 넣는다.

## 4. 사진

16장 전부 JPEG, 인물·제품 사진. 텍스트만 옮기면 원본과 다른 물건이 되는 만큼 배치 규칙이 디자인의 절반이다.

반복되는 크기가 명확하다.

| 크기 (inch) | 비율 | 쓰임 |
|---|---|---|
| **4.92 × 6.39** | 0.77 | 기본 세로 블록. slide7에 2개 나란히, slide8에 1개 |
| **4.35 × 4.35** | 1.00 | 정사각 블록. slide9에 세로 2개 스택 |
| 4.31 × 5.47 / 8.62 × 3.87 | — | 모자이크 구성 (slide4) |
| 폭 7.5~11 × 높이 11.25 | — | 풀블리드 세로 패널 (slide5·6·8) |

배치 규칙:

- **풀블리드는 화면 가장자리에 딱 붙인다** — x=0 또는 y=0에서 시작해 캔버스 끝까지. 여백 1.12를 지키지 않는 유일한 요소다.
- **블록 사진은 여백선(1.12)에 정렬한다** — slide7 두 장은 x=1.12, x=6.94, 간격 0.90.
- **사진 위에 큰 텍스트를 얹는다** — 겹치는 구간에서만 흰색·빨강 텍스트를 쓴다.

주의: 이 사진들은 pptx에서 `<p:pic>`이 **아니다.** Canva는 사진을 그룹(`<p:grpSp>`) 안 도형의 `blipFill`로 넣는다. python-pptx에서 `shape.shape_type == PICTURE`로 훑으면 **0개가 나온다.** 그룹을 재귀로 들어가 `blipFill`을 찾아야 하고, 좌표도 그룹의 `chOff`/`chExt` → `off`/`ext` 스케일을 거쳐야 실제 위치가 된다.

## 5. 레이아웃 패턴 7종

새 덱을 짤 때 이 7개를 조합한다.

| # | 패턴 | 원본 | 구성 |
|---|---|---|---|
| 1 | **표지** | 1 | 좌측 세로 사진(6.99×8.02) + 우측 초대형 2줄 타이틀 174pt + 상단 양끝 러닝헤더 24pt + 하단 전폭 본문 |
| 2 | **목차** | 2 | 좌측 항목 리스트 77.57pt(항목마다 `(01)` 번호) + 우측 세로 사진 패널 |
| 3 | **섹션 오프너** | 3 | 좌상단 선언 문장 95pt + 우측 사진 + 우하단 섹션 번호 58pt + 좌하단 본문 |
| 4 | **항목·값** | 4 | 좌측 제목 95pt + `라벨: 값` 3행(26.23pt, 행 간격 1.38) + 우측 사진 모자이크 3장 |
| 5 | **전면 타이틀** | 5·9 | 풀블리드 사진 + 초대형 빨강 타이틀 142~174pt + 번호. 텍스트 최소, 전환용 |
| 6 | **제목·본문·사진** | 6·7·8 | 제목 93~195pt + `DESCRIPTION` 라벨 26.23pt + 본문 16pt + 사진 블록 1~2장 |
| 7 | **연락처** | 10 | 초대형 타이틀 195pt 중앙 + 네 귀퉁이에 URL·메일·SNS 19.44/17.28pt. 사진 없음 |

10장 중 5장(1·5·6·8·9)이 사진 위주다. 텍스트 밀도가 높은 슬라이드는 4·7뿐이다. 이 비율을 유지해야 같은 느낌이 난다.

---

## 6. 이 DESIGN.md를 만드는 방법

다른 pptx를 받았을 때 같은 문서를 뽑는 절차다. 실습에서 수강생이 실제로 하는 일이 이것이다.

### 절차

1. **pptx를 zip으로 연다.** pptx는 zip이다. `ppt/slides/slideN.xml`이 슬라이드, `ppt/theme/theme1.xml`이 테마, `ppt/media/`가 이미지다.
2. **캔버스를 먼저 읽는다.** `ppt/presentation.xml`의 `<p:sldSz cx cy>`. 이걸 모르면 나머지 좌표가 전부 무의미하다.
3. **색은 테마가 아니라 슬라이드에서 뽑는다.** `srgbClr val=`을 전 슬라이드에서 세어 빈도순 정렬. 상위 2~4개가 실제 팔레트다.
4. **폰트와 크기를 센다.** `<a:rPr sz spc>` + `<a:latin typeface>`. 크기별 빈도를 세면 스케일이 드러나고, 가장 많이 쓰인 작은 값이 본문이다.
5. **자간은 비율로 환산한다.** `spc ÷ sz`. 절대값으로 적으면 다른 크기에 못 쓴다.
6. **좌표를 inch로 뽑아 반복값을 찾는다.** 같은 x가 여러 슬라이드에 나오면 그게 여백선, 같은 w×h가 반복되면 그게 표준 블록이다.
7. **슬라이드를 패턴으로 묶는다.** 10장을 10개로 적으면 못 쓴다. 구성이 같은 것끼리 묶어 5~8개 패턴으로 줄인다.
8. **재현을 막는 함정을 적는다.** 임베드 폰트, 비표준 캔버스, 테마 불일치, `blipFill` 이미지 — 이 문서에서 제일 값어치 있는 부분이다.

### 추출 스크립트

이 문서의 수치는 전부 아래 스크립트로 뽑았다. 표준 라이브러리만 쓴다.

```python
import zipfile, xml.etree.ElementTree as ET, collections, re

A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'
EMU = 914400.0
z = zipfile.ZipFile('creative_brief_deck.pptx')

# 1) 캔버스
sz = ET.fromstring(z.read('ppt/presentation.xml')).find(P + 'sldSz')
print('canvas', int(sz.get('cx')) / EMU, 'x', int(sz.get('cy')) / EMU, 'inch')

# 2) 색 — 테마 말고 슬라이드에서
colors = collections.Counter()
for n in z.namelist():
    if re.match(r'ppt/slides/slide\d+\.xml$', n):
        colors.update(re.findall(r'srgbClr val="([0-9A-Fa-f]{6})"', z.read(n).decode()))
print('palette', colors.most_common(6))

# 3) 타이포 — 크기·폰트·자간비율
type_scale = collections.Counter()
for n in sorted(z.namelist()):
    if not re.match(r'ppt/slides/slide\d+\.xml$', n):
        continue
    for r in ET.fromstring(z.read(n)).iter(A + 'r'):
        pr = r.find(A + 'rPr')
        if pr is None or not pr.get('sz'):
            continue
        pt = int(pr.get('sz')) / 100
        latin = pr.find(A + 'latin')
        spc = int(pr.get('spc') or 0) / 100
        type_scale[(pt, latin.get('typeface') if latin is not None else '?',
                    round(spc / pt * 100, 1))] += 1
for (pt, font, track), cnt in sorted(type_scale.items(), reverse=True):
    print(f'  {pt:>7}pt  {font:<24} tracking {track:>6}%  x{cnt}')

# 4) 사진 좌표 — Canva는 <p:pic>이 아니라 그룹 안 도형의 blipFill로 넣는다.
#    그룹 좌표계(chOff/chExt -> off/ext)를 거쳐야 실제 위치가 나온다.
for i in range(1, 11):
    root = ET.fromstring(z.read(f'ppt/slides/slide{i}.xml'))
    for g in root.iter(P + 'grpSp'):
        gx = g.find(P + 'grpSpPr/' + A + 'xfrm')
        if gx is None:
            continue
        go, ge = gx.find(A + 'off'), gx.find(A + 'ext')
        co, ce = gx.find(A + 'chOff'), gx.find(A + 'chExt')
        sx = int(ge.get('cx')) / int(ce.get('cx'))
        sy = int(ge.get('cy')) / int(ce.get('cy'))
        for sp in g.iter(P + 'sp'):
            if sp.find('.//' + A + 'blipFill') is None:
                continue
            x = sp.find(P + 'spPr/' + A + 'xfrm')
            if x is None:
                continue
            o, e = x.find(A + 'off'), x.find(A + 'ext')
            X = ((int(o.get('x')) - int(co.get('x'))) * sx + int(go.get('x'))) / EMU
            Y = ((int(o.get('y')) - int(co.get('y'))) * sy + int(go.get('y'))) / EMU
            W = int(e.get('cx')) * sx / EMU
            H = int(e.get('cy')) * sy / EMU
            print(f'  slide{i} IMG x={X:6.2f} y={Y:6.2f} w={W:5.2f} h={H:5.2f}')
```

### Claude에게 시킬 때

스크립트를 직접 돌리지 않고 맡기는 쪽이 실습 흐름에 맞다. 다만 그냥 "분석해줘"라고 하면 테마 색을 읽고 끝내므로, 함정을 프롬프트에 박아 둔다.

```
이 pptx의 디자인 시스템을 DESIGN.md로 정리해줘. 원본 없이도 같은 디자인의
새 덱을 만들 수 있을 만큼 구체적으로.

pptx를 zip으로 풀어서 XML을 직접 읽어. 다음은 꼭 지켜줘:
- 캔버스 크기를 presentation.xml의 sldSz에서 먼저 확인할 것
- 색은 theme1.xml 말고 slideN.xml의 srgbClr 빈도로 뽑을 것 (테마는 기본값일 수 있음)
- 폰트는 크기(sz)와 자간(spc)을 같이 뽑고, 자간은 spc/sz 비율(%)로 환산할 것
- 좌표는 inch(EMU/914400)로 바꾸고, 여러 슬라이드에 반복되는 값(여백선, 표준
  사진 크기)을 찾아낼 것
- 사진이 <p:pic>으로 안 잡히면 그룹 안 도형의 blipFill을 확인할 것
- 슬라이드를 하나씩 나열하지 말고 구성이 같은 것끼리 레이아웃 패턴으로 묶을 것
- 마지막에 "재현할 때 걸리는 지점"을 따로 정리할 것 (임베드 폰트, 비표준 캔버스 등)
```

### 검증

DESIGN.md가 쓸 만한지 확인하는 방법은 하나다. **원본을 닫고 이 문서만 보고 1~2장을 다시 만든 뒤, 원본과 나란히 놓고 본다.** 어긋나면 문서에 빠진 항목이 있는 것이다. 실제로 이 순서로 잘 틀어진다.

1. 자간 — 안 적으면 디스플레이 텍스트가 벌어진다
2. 캔버스 크기 — 안 맞추면 좌표가 전부 어긋난다
3. 사진 비율 — 크기만 적고 crop 방식을 안 적으면 인물이 잘린다
4. 색이 쓰이는 **조건** — HEX만 적고 "섹션 오프너에만 빨강"을 안 적으면 아무 데나 빨강이 들어간다
