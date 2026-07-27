# pptx에서 디자인 시스템 뽑아내기

pptx를 받았을 때 **원본 없이도 같은 디자인을 재현할 수 있는 문서**(`*.DESIGN.md`)를 만드는 절차다. 실습에서 수강생이 실제로 하는 일이 이것이다.

이 폴더의 결과물 두 개가 이 절차로 나왔다 — [`creative_brief_deck.DESIGN.md`](creative_brief_deck.DESIGN.md), [`ictk_deck_template.DESIGN.md`](ictk_deck_template.DESIGN.md). 성격이 정반대인 덱(다운로드한 디자인 템플릿 vs 코드로 생성한 사내 템플릿)이라 둘을 같이 보면 절차가 어디까지 통하는지 드러난다.

## 절차

1. **pptx를 zip으로 연다.** pptx는 zip이다. `ppt/slides/slideN.xml`이 슬라이드, `ppt/theme/theme1.xml`이 테마, `ppt/media/`가 이미지다.
2. **캔버스를 먼저 읽는다.** `ppt/presentation.xml`의 `<p:sldSz cx cy>`. 이걸 모르면 나머지 좌표가 전부 무의미하다.
3. **색은 테마가 아니라 슬라이드에서 뽑는다.** `srgbClr val=`을 전 슬라이드에서 세어 빈도순 정렬. 상위 2~4개가 실제 팔레트다.
4. **폰트와 크기를 센다.** `<a:rPr sz spc>` + `<a:latin typeface>`. 크기별 빈도를 세면 스케일이 드러나고, 가장 많이 쓰인 작은 값이 본문이다.
5. **자간은 비율로 환산한다.** `spc ÷ sz`. 절대값으로 적으면 다른 크기에 못 쓴다.
6. **좌표를 inch로 뽑아 반복값을 찾는다.** 같은 x가 여러 슬라이드에 나오면 그게 여백선, 같은 w×h가 반복되면 그게 표준 블록이다.
7. **슬라이드를 패턴으로 묶는다.** 10장을 10개로 적으면 못 쓴다. 구성이 같은 것끼리 묶어 5~8개 패턴으로 줄인다.
8. **설계 단위를 역산한다.** pt 값이 39·22.5·18.75처럼 0.75 배수로 떨어지면 원 설계가 **px**다. `px × 0.75 = pt`, `px ÷ 96 = inch`로 되돌리면 39pt → 52px 같은 깔끔한 원본 수치가 나오고, 그게 디자이너가 실제로 쓴 값이다. 캔버스 20 × 11.25 inch도 1920 × 1080 px의 다른 표기다.
9. **자체 문서와 실제 값을 대조한다.** 덱 안에 스타일 가이드 슬라이드가 있어도 그대로 믿지 않는다. `ictk_deck_template.pptx`는 가이드에 Pretendard라고 적혀 있지만 XML에는 Noto Sans KR이 박혀 있다. 문서는 의도, XML은 사실이다.
10. **재현을 막는 함정을 적는다.** 임베드 폰트, 비표준 캔버스, 테마 불일치, `blipFill` 이미지, 선언과 실제의 불일치 — 이 문서에서 제일 값어치 있는 부분이다.

## 추출 스크립트

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

## Claude에게 시킬 때

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
- pt 값이 0.75 배수로 떨어지면 원 설계가 px이니 px 값으로 역산해 함께 적을 것
- 덱 안에 스타일 가이드 슬라이드가 있으면 실제 XML 값과 대조하고, 다르면 둘 다 적을 것
- 슬라이드를 하나씩 나열하지 말고 구성이 같은 것끼리 레이아웃 패턴으로 묶을 것
- 마지막에 "재현할 때 걸리는 지점"을 따로 정리할 것 (임베드 폰트, 비표준 캔버스 등)
```

## 검증

DESIGN.md가 쓸 만한지 확인하는 방법은 하나다. **원본을 닫고 이 문서만 보고 1~2장을 다시 만든 뒤, 원본과 나란히 놓고 본다.** 어긋나면 문서에 빠진 항목이 있는 것이다. 실제로 이 순서로 잘 틀어진다.

1. 자간 — 안 적으면 디스플레이 텍스트가 벌어진다
2. 캔버스 크기 — 안 맞추면 좌표가 전부 어긋난다
3. 사진 비율 — 크기만 적고 crop 방식을 안 적으면 인물이 잘린다
4. 색이 쓰이는 **조건** — HEX만 적고 "섹션 오프너에만 빨강"을 안 적으면 아무 데나 빨강이 들어간다
