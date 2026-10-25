var e=e=>`url("data:image/svg+xml,`+encodeURIComponent(e)+`")`,t=`xmlns='http://www.w3.org/2000/svg'`,n=`M20 5L21.5 1.5L22.5 5.6C26 3.5 31 2 38 5C36 6 35.5 7 35 9C33.5 8 32.5 8.5 31.5 11C30 9.6 28 9.8 26.5 13C25.5 11 24.5 10 23 10L21.5 14L20 16L18.5 14L17 10C15.5 10 14.5 11 13.5 13C12 9.8 10 9.6 8.5 11C7.5 8.5 6.5 8 5 9C4.5 7 4 6 2 5C9 2 14 3.5 17.5 5.6L18.5 1.5Z`,r=`<svg ${t} viewBox='0 0 64 64'>
  <defs><radialGradient id='g' cx='38%' cy='34%' r='72%'><stop offset='0' stop-color='#ffe6b0'/><stop offset='1' stop-color='#e8892f'/></radialGradient></defs>
  <circle cx='32' cy='32' r='28' fill='url(#g)'/>
  <circle cx='21' cy='23' r='5.5' fill='#c46d1c' fill-opacity='.32'/>
  <circle cx='41' cy='40' r='7.5' fill='#c46d1c' fill-opacity='.28'/>
  <circle cx='43' cy='19' r='3.2' fill='#c46d1c' fill-opacity='.3'/>
  <circle cx='17' cy='42' r='3' fill='#c46d1c' fill-opacity='.25'/>
  <path d='${n}' fill='#1a0d2e' transform='translate(11 26) scale(.9)'/>
</svg>`,i=`<svg ${t} viewBox='0 0 40 20'><path d='${n}' fill='#6a46a8'/></svg>`,a=`<svg ${t} viewBox='0 0 16 48' fill='none'>
  <line x1='8' y1='0' x2='8' y2='33' stroke='#fff' stroke-opacity='.4' stroke-width='.8'/>
  <g stroke='#8d6fd6' stroke-width='1' stroke-linecap='round'>
    <path d='M5.4 37.5L2 35L1 38M5.2 39.2L1.5 40.5M5.6 40.8L2.5 44M10.6 37.5L14 35L15 38M10.8 39.2L14.5 40.5M10.4 40.8L13.5 44'/>
  </g>
  <ellipse cx='8' cy='40' rx='3.6' ry='4.4' fill='#2b1b4a' stroke='#8d6fd6' stroke-width='.8'/>
  <circle cx='8' cy='34.6' r='2.2' fill='#2b1b4a' stroke='#8d6fd6' stroke-width='.8'/>
  <circle cx='7.2' cy='34.3' r='.5' fill='#ff8c42'/><circle cx='8.8' cy='34.3' r='.5' fill='#ff8c42'/>
</svg>`;function o(){let e=[0,22.5,45,67.5,90].map(e=>e*Math.PI/180),n=(e,t)=>[(e*Math.cos(t)).toFixed(1),(e*Math.sin(t)).toFixed(1)],r=e.map(e=>`M0 0L${n(80,e).join(` `)}`).join(``);return[18,34,50,68].forEach(t=>{r+=`M`+n(t,e[0]).join(` `);for(let i=1;i<e.length;i++){let a=(e[i-1]+e[i])/2;r+=`Q${n(t*.8,a).join(` `)} ${n(t,e[i]).join(` `)}`}}),`<svg ${t} viewBox='0 0 80 80' fill='none'><path d='${r}' stroke='#fff' stroke-width='.9' stroke-linecap='round'/></svg>`}var s=`<svg ${t} viewBox='0 0 24 24'>
  <path d='M12 6.2C12 4.4 12.8 3.2 14.4 2.4' stroke='#7da32c' stroke-width='1.9' fill='none' stroke-linecap='round'/>
  <ellipse cx='7.4' cy='14.2' rx='5.4' ry='7.2' fill='#e8751a'/>
  <ellipse cx='16.6' cy='14.2' rx='5.4' ry='7.2' fill='#e8751a'/>
  <ellipse cx='12' cy='14.2' rx='4.4' ry='7.8' fill='#ff9433'/>
  <path d='M7.6 13.2l1.9-2.7 1.7 2.7zM12.8 13.2l1.7-2.7 1.9 2.7z' fill='#2a1304'/>
  <path d='M7.7 16.2h8.6l-1.5 2.9-1.7-1.5-1.1 1.5-1.1-1.5-1.7 1.5z' fill='#2a1304'/>
</svg>`,c=`<svg ${t} viewBox='0 0 24 24'><path d='M12 1C12.6 8 16 11.4 23 12c-7 .6-10.4 4-11 11-.6-7-4-10.4-11-11 7-.6 10.4-4 11-11z' fill='#ffb066'/></svg>`,l=document.documentElement.style;l.setProperty(`--hw-spark`,e(c)),l.setProperty(`--hw-moon`,e(r)),l.setProperty(`--hw-bat`,e(i)),l.setProperty(`--hw-spider`,e(a)),l.setProperty(`--hw-web`,e(o())),l.setProperty(`--hw-pumpkin`,e(s));