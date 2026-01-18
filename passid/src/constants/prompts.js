/**
 * @file prompts.js
 * @description AI generation prompts for ID photos.
 * These prompts are sensitive assets and are managed in this separate file for organization.
 */

export const ID_PHOTO_PROMPTS = {
    MALE: {
        title: "남자 버전 (Male Version)",
        description: "남성용 정장 스타일 증명사진 제작 프롬프트",
        content: `IMPORTANT: Use the uploaded reference image(s) as the fixed and unchangeable identity source.
Do NOT generate a new face.
Do NOT reinterpret or redesign the person.
Preserve the exact same person from the reference image.

This task is NOT face generation.
This task is ID photo presentation adjustment only.

Keep the subject’s original facial structure exactly as-is:
same eye spacing and shape,
same eyelid structure,
same nose bridge and nose tip,
same lip shape and thickness,
same cheekbone placement,
same jawline and chin shape,
same facial proportions overall.
No face variation is allowed.

Adjust ONLY lighting, framing, pose neutrality, and background
to match a standard Korean official ID / passport photo.

---

Ultra-realistic Korean ID photo portrait.
Recreate the subject’s exact facial structure and hairstyle based on the provided reference images.
Maintain precise identity consistency: same face proportions, eye shape, nose bridge, lip thickness, jawline, and hair parting.

The subject is Korean man wearing a formal black suit, white dress shirt, and dark navy or black tie.
Clean, professional, and neutral impression suitable for official documents.

Pose & Framing
- Straight-on front-facing pose
- Head centered, shoulders visible
- Neutral expression, lips gently closed
- Eyes looking directly into the camera
- No tilt, no angle, no asymmetry

Hair
- Natural black hair
- Neatly styled, soft volume
- Middle-part or slightly off-center part
- No flyaways, no exaggerated styling
- Realistic hair strands and density

Skin & Face Detail
- Natural Korean skin tone
- Subtle warmth, no heavy whitening
- Visible fine pores, faint skin texture
- Slight natural under-eye shading
- No beauty-filter smoothing
- No makeup look (very minimal, clean skin finish)

Lighting
- Even studio lighting
- Soft frontal light, shadow-free
- No dramatic highlights or contrast
- Pure white background (#FFFFFF)

Camera & Quality
- High-resolution DSLR realism
- Sharp focus, no blur
- True-to-life color balance
- No cinematic mood, no stylization

Strict Restrictions
- No smile
- No facial expression exaggeration
- No fashion pose
- No background objects
- No artistic or editorial look
- Must look indistinguishable from a real Korean passport / ID photo

[NEGATIVE PROMPT]
cartoon, illustration, anime, painting, beauty filter, smooth skin, plastic skin, over-retouched, blur, low resolution, cinematic lighting, dramatic shadows, side angle, tilted head, head tilt, smiling, open mouth, exaggerated expression, fashion pose, casual clothes, accessories, earrings, necklace, piercing, glasses, sunglasses, heavy makeup, contouring, glossy lips, strong blush, false eyelashes, colored hair, flyaway hair, messy hair, background objects, textured background, color background, gray background, gradient background, editorial look, artistic style`
    },
    FEMALE: {
        title: "여자 버전 (Female Version)",
        description: "여성용 정장 스타일 증명사진 제작 프롬프트",
        content: `IMPORTANT: Use the uploaded reference image(s) as the fixed and unchangeable identity source.
Do NOT generate a new face.
Do NOT reinterpret or redesign the person.
Preserve the exact same person from the reference image.

This task is NOT face generation.
This task is ID photo presentation adjustment only.

Keep the subject’s original facial structure exactly as-is:
same eye spacing and shape,
same eyelid structure,
same nose bridge and nose tip,
same lip shape and thickness,
same cheekbone placement,
same jawline and chin shape,
same facial proportions overall.
No face variation is allowed.

Adjust ONLY lighting, framing, pose neutrality, and background
to match a standard Korean official ID / passport photo.

---

Ultra-realistic Korean ID photo portrait of the SAME PERSON as the reference image.

The subject is a young Korean woman wearing a formal black blazer or dark jacket with a clean inner top.
Professional, neutral, and calm impression suitable for official documents.

Pose & Framing
- Straight-on front-facing pose
- Head perfectly centered
- Shoulders visible
- Neutral expression
- Lips gently closed (no smile)
- Eyes looking directly into the camera
- No head tilt, no angle, no asymmetry

Hair
- Natural black or dark brown hair
- Neatly styled and professional
- Middle-part or slightly off-center part
- Hair tied back or naturally falling behind shoulders
- No flyaways, no exaggerated volume
- Realistic individual hair strands and natural density

Skin & Face Detail
- Natural Korean skin tone with subtle warmth
- No heavy whitening or artificial brightening
- Visible fine pores and realistic skin texture
- Very subtle natural under-eye shading
- No beauty filter smoothing

Makeup (ID-appropriate, very minimal)
- Clean natural skin finish
- No visible foundation texture
- Lips look naturally healthy and lively, as if wearing a sheer lip tint or light lip balm
- Soft pink or rosy lip tone
- No glossy shine, no bold lipstick, no lip liner
- Natural lip texture with subtle creases preserved

Lighting
- Even studio lighting
- Soft frontal light
- Shadow-free
- No dramatic highlights or contrast
- Pure white background (#FFFFFF)

Camera & Quality
- High-resolution DSLR realism
- Sharp focus
- No blur
- True-to-life color balance
- No cinematic mood
- No stylization

Strict Requirements
- Must look indistinguishable from a real Korean passport / official ID photo
- This must look like a real photograph of the SAME PERSON, not an AI-generated face
- No beauty, editorial, or fashion styling

[NEGATIVE PROMPT]
cartoon, illustration, anime, painting, beauty filter, smooth skin, plastic skin, over-retouched, blur, low resolution, cinematic lighting, dramatic shadows, side angle, tilted head, head tilt, smiling, open mouth, exaggerated expression, fashion pose, casual clothes, accessories, earrings, necklace, piercing, glasses, sunglasses, heavy makeup, contouring, glossy lips, strong blush, false eyelashes, colored hair, flyaway hair, messy hair, background objects, textured background, color background, gray background, gradient background, editorial look, artistic style`
    },
    GUIDE: {
        steps: [
            "제미나이(나노바나나 프로)를 실행합니다.",
            "본인의 평소 셀카 사진을 업로드합니다. (3장 권장, 명확한 사진은 1장도 가능)",
            "성별에 맞는 아래 프롬프트를 복사하여 입력창에 넣고 생성합니다."
        ]
    }
};
