import { useEffect, useState } from "react";
import "./OpeningAnimation.css";

const SVG_CONTENT = String.raw`
<defs>
  <symbol id="spark" viewBox="-10 -10 20 20"><path d="M0-10 Q1 -1 10 0 Q1 1 0 10 Q-1 1 -10 0 Q-1 -1 0 -10Z" fill="#f7c531"/></symbol>
  <symbol id="fl" viewBox="-20 -20 40 40" overflow="visible">
    <g fill="currentColor" stroke="#7a3b3b" stroke-width=".8" stroke-opacity=".5">
      <ellipse cx="0" cy="-11" rx="7" ry="10"/><ellipse cx="0" cy="-11" rx="7" ry="10" transform="rotate(72)"/>
      <ellipse cx="0" cy="-11" rx="7" ry="10" transform="rotate(144)"/><ellipse cx="0" cy="-11" rx="7" ry="10" transform="rotate(216)"/>
      <ellipse cx="0" cy="-11" rx="7" ry="10" transform="rotate(288)"/></g>
    <circle r="6" fill="#f9d44a"/>
  </symbol>
  <symbol id="tulip" viewBox="0 0 80 100" overflow="visible">
    <path d="M4 22 Q4 4 16 0 L30 16 L40 -2 L50 16 L64 0 Q76 4 76 22 Q76 66 40 82 Q4 66 4 22Z" fill="currentColor"/>
    <path d="M40 -2 L50 16 Q60 50 40 82 Q22 60 30 16Z" fill="#fff" opacity=".18"/>
    <path d="M14 66 Q40 96 66 66 Q40 74 14 66Z" fill="#8fbf5a"/>
  </symbol>
  <symbol id="sprig" viewBox="0 0 60 90" overflow="visible">
    <path d="M30 88 Q10 50 30 4" stroke="#6b9a3a" stroke-width="3" fill="none"/>
    <g fill="#8fbf5a" stroke="#4d7a2e" stroke-width="1.2">
      <ellipse cx="14" cy="62" rx="6" ry="13" transform="rotate(-25 14 62)"/><ellipse cx="46" cy="58" rx="6" ry="13" transform="rotate(25 46 58)"/>
      <ellipse cx="14" cy="34" rx="6" ry="13" transform="rotate(-25 14 34)"/><ellipse cx="46" cy="30" rx="6" ry="13" transform="rotate(25 46 30)"/>
      <ellipse cx="30" cy="10" rx="5" ry="11"/></g>
  </symbol>
  <pattern id="grass" width="70" height="46" patternUnits="userSpaceOnUse">
    <path d="M8 46 Q10 20 4 6 M22 46 Q22 28 28 14 M40 46 Q38 22 44 4 M56 46 Q58 30 52 18" stroke="#8fbf5a" stroke-width="2" fill="none" stroke-linecap="round"/>
  </pattern>
</defs>

<!-- background -->
<rect class="bg" width="2132" height="738" rx="14" fill="#fdf1e4"/>

<!-- dashed paths -->
<g class="trails" fill="none" stroke="#b5495b" stroke-width="2" stroke-dasharray="7 6">
  <path d="M0 125 Q100 182 190 176 Q252 150 252 118 Q240 94 206 100 Q178 128 196 172 Q250 246 372 224"/>
  <path d="M2132 118 Q1990 -10 1840 70 Q1700 160 1720 320 Q1740 470 1850 540 Q1880 560 1900 560"/>
  <path d="M1740 580 Q1650 500 1700 420 Q1770 340 1830 395 Q1840 425 1770 422"/>
</g>

<!-- sparkles -->
<use href="#spark" x="498" y="108" width="30" height="30"/><use href="#spark" x="518" y="134" width="14" height="14"/>
<use href="#spark" x="62" y="256" width="36" height="36"/><use href="#spark" x="514" y="512" width="18" height="18"/>
<use href="#spark" x="1610" y="154" width="18" height="18"/><use href="#spark" x="2066" y="226" width="22" height="22"/>
<use href="#spark" x="1728" y="462" width="34" height="34"/>

<!-- ladybug -->
<g class="lb"><g transform="translate(388 198) rotate(20)">
  <ellipse cx="0" cy="0" rx="26" ry="20" fill="#e5384f"/><path d="M0-20 V20" stroke="#8a1c2c" stroke-width="2"/>
  <circle cx="-10" cy="-5" r="4" fill="#8a1c2c"/><circle cx="10" cy="6" r="4" fill="#8a1c2c"/><circle cx="-8" cy="10" r="3" fill="#8a1c2c"/>
  <circle cx="-26" cy="-4" r="9" fill="#fff" opacity=".9"/><path d="M-30 -18 q-6 -4 -12 -2 M-26 -20 q-2 -8 -8 -10" stroke="#8a1c2c" fill="none"/></g>
</g>

<!-- left bush & ground -->
<path class="bush" d="M0 396 Q50 400 80 470 Q130 480 160 495 Q210 500 235 520 Q300 508 336 580 L0 580Z" fill="#9dc25a"/>
<rect class="ground" x="0" y="580" width="2132" height="105" fill="#7f9f4d"/>
<rect class="grass" x="340" y="540" width="1450" height="46" fill="url(#grass)"/>
<rect y="684" width="2132" height="4" fill="#f6c58a" opacity=".8"/>

<!-- right bushes + tulips -->
<path class="bush" d="M1812 580 Q1830 520 1900 515 Q1930 480 1990 476 Q2060 480 2070 520 Q2100 450 2132 380 V580Z" fill="#a5c85e"/>
<g class="stems" stroke="#8fbf5a" stroke-width="5" stroke-linecap="round">
  <path d="M1990 200 V500"/><path d="M1864 310 V520"/><path d="M1942 380 V510"/><path d="M2068 380 V460"/></g>
<use class="tulip" href="#tulip" x="1946" y="114" width="92" height="115" style="color:#fb9a1c;transform-origin:1992px 229px;--d:1.3s"/>
<use class="tulip" href="#tulip" x="1822" y="232" width="86" height="108" style="color:#fdd44a;transform-origin:1865px 340px;--d:1.5s"/>
<use class="tulip" href="#tulip" x="1904" y="308" width="72" height="90" style="color:#f6788f;transform-origin:1940px 398px;--d:1.65s"/>
<use class="tulip" href="#tulip" x="2028" y="318" width="68" height="85" style="color:#fdc93a;transform-origin:2062px 403px;--d:1.8s"/>

<!-- ground flowers -->
<g class="gfl" style="transform-origin:198px 604px;--d:1.1s"><use href="#fl" x="150" y="556" width="96" height="96" style="color:#f48aa0" transform="rotate(-20 198 604)"/></g>
<use class="gfl" href="#fl" x="1896" y="560" width="116" height="116" style="color:#fbb82a;transform-origin:1954px 618px;--d:1.4s"/>
<g class="daisies" fill="#fff">
  <g id="dz"><circle cx="0" cy="-5" r="5"/><circle cx="5" cy="0" r="5"/><circle cx="0" cy="5" r="5"/><circle cx="-5" cy="0" r="5"/><circle r="3" fill="#f9d44a"/></g>
  <use href="#dz" x="48" y="609"/><use href="#dz" x="94" y="598"/><use href="#dz" x="348" y="630"/><use href="#dz" x="630" y="624"/>
  <use href="#dz" x="996" y="612"/><use href="#dz" x="1138" y="621"/><use href="#dz" x="1188" y="606"/><use href="#dz" x="1562" y="628"/>
  <use href="#dz" x="2094" y="598"/><use href="#dz" x="2040" y="636"/>
</g>

<!-- Jasmine frame -->
<g fill="none">
  <rect class="draw" pathLength="1" x="490" y="258" width="486" height="173" rx="86" stroke="#e5677d" stroke-width="4"/>
  <rect class="inner" x="502" y="270" width="462" height="149" rx="74" stroke="#f3c3a0" stroke-width="1.5" stroke-dasharray="5 4"/>
</g>
<rect x="580" y="250" width="40" height="16" fill="#fdf1e4"/>
<path d="M520 336 q-8-10 0-12 q8-2 8 8 q0 6-8 14 q-8-8-8-10" fill="#e5677d" transform="translate(4 4) scale(.9)"/>
<path d="M944 336 q-8-10 0-12 q8-2 8 8 q0 6-8 14 q-8-8-8-10" fill="#e5677d" transform="translate(4 4) scale(.9)"/>
<use class="cf" href="#fl" x="498" y="224" width="86" height="86" style="color:#f0617a;transform-origin:541px 267px;--d:2.5s"/>
<path d="M596 238 q8-14 14-2 q4 8-14 20 q-14-12-6-20z" fill="#e5677d" transform="translate(4 -6) scale(.8)"/>
<use href="#sprig" x="456" y="338" width="62" height="90"/>
<use href="#sprig" x="936" y="338" width="62" height="90" transform="translate(1934 0) scale(-1 1)" style="display:none"/>
<g transform="translate(990 338) scale(-1 1)"><use href="#sprig" x="0" y="0" width="62" height="90"/></g>
<text class="n1 nl" x="731" y="378" font-size="124" text-anchor="middle" textLength="366" lengthAdjust="spacingAndGlyphs">Jasmine</text>

<!-- center heart -->
<g class="rays" stroke="#e5677d" stroke-width="2.5" stroke-linecap="round">
  <path d="M1004 345 h12 M1100 345 h12"/><path d="M1013 314 l10 10 M1103 314 l-10 10 M1013 380 l10 -10 M1103 380 l-10 -10"/></g>
<path class="heart" d="M1058 378 C1018 348 1026 318 1046 320 Q1058 322 1058 334 Q1058 322 1070 320 C1090 318 1098 348 1058 378Z" fill="#e5677d"/>

<!-- Vakeem frame -->
<g fill="none">
  <rect class="draw d2" pathLength="1" x="1136" y="258" width="464" height="173" rx="86" stroke="#4d7a2e" stroke-width="4"/>
  <rect class="inner" x="1148" y="270" width="440" height="149" rx="74" stroke="#d9d19a" stroke-width="1.5" stroke-dasharray="5 4"/>
</g>
<rect x="1470" y="250" width="40" height="16" fill="#fdf1e4"/>
<path d="M1170 346 q-8-10 0-12 q8-2 8 8 q0 6-8 14 q-8-8-8-10" fill="#7f9f4d" transform="translate(4 4) scale(.9)"/>
<path d="M1562 346 q-8-10 0-12 q8-2 8 8 q0 6-8 14 q-8-8-8-10" fill="#7f9f4d" transform="translate(4 4) scale(.9)"/>
<use class="cf" href="#fl" x="1500" y="222" width="90" height="90" style="color:#fdd44a;transform-origin:1545px 267px;--d:2.7s"/>
<path d="M1490 238 q-14-10-4-14 q10 2 14 14z" fill="#8fbf5a" stroke="#4d7a2e"/>
<use href="#sprig" x="1112" y="338" width="62" height="90"/>
<g transform="translate(1654 338) scale(-1 1)"><use href="#sprig" x="0" y="0" width="62" height="90"/></g>
<text class="n2 nr" x="1364" y="388" font-size="138" text-anchor="middle" textLength="340" lengthAdjust="spacingAndGlyphs">Vakeem</text>
`;

export function OpeningAnimation({ onComplete }) {
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const prefersReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;
        const closeDelay = prefersReducedMotion ? 350 : 5700;
        const finishDelay = prefersReducedMotion ? 550 : 6350;
        const closeTimer = window.setTimeout(() => setClosing(true), closeDelay);
        const finishTimer = window.setTimeout(() => onComplete?.(), finishDelay);

        return () => {
            window.clearTimeout(closeTimer);
            window.clearTimeout(finishTimer);
            document.body.style.overflow = previousOverflow;
        };
    }, [onComplete]);

    return (
        <div
            className={`opening-screen${closing ? " is-closing" : ""}`}
            role="status"
            aria-label="Jasmine and Vakeem welcome animation"
        >
            <svg
                className="opening-art play"
                viewBox="0 0 2132 738"
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label="Jasmine and Vakeem"
                dangerouslySetInnerHTML={{ __html: SVG_CONTENT }}
            />
        </div>
    );
}
