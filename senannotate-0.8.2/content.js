"use strict";(()=>{var q="#f97316",on=[{value:q,label:"Orange (default)"},{value:"#3b82f6",label:"Blue"},{value:"#8b5cf6",label:"Violet"},{value:"#10b981",label:"Green"},{value:"#ec4899",label:"Pink"},{value:"#ef4444",label:"Red"}],Qo=/^#[0-9a-f]{6}$/i;function Mt(t){let e=t/255;return e<=.04045?e/12.92:((e+.055)/1.055)**2.4}function Zo(t){let e=Mt(parseInt(t.slice(1,3),16)),n=Mt(parseInt(t.slice(3,5),16)),o=Mt(parseInt(t.slice(5,7),16));return .2126*e+.7152*n+.0722*o}var Jo=.3;function Oe(t){let e=Qo.test(t)?t:q,n=Zo(e)>Jo;return{accent:e,strong:`color-mix(in srgb, ${e} 82%, black)`,ink:n?`color-mix(in srgb, ${e} 22%, black)`:`color-mix(in srgb, ${e} 18%, white)`}}var rn=[{value:"ui",label:"UI",hint:"Layout, spacing, styling"},{value:"bug",label:"Bug",hint:"It does the wrong thing"},{value:"copy",label:"Copy",hint:"Wording, tone, translation"},{value:"question",label:"Question",hint:"Needs an answer before it can be changed"}];function de(t){return t.kind??"ui"}function F(t){return t.status==="done"}var ue={detailLevel:"standard",componentMode:"filtered",theme:"auto",showMarkers:!0,measureTools:!1,showBoxModel:!1,freezeOnInspect:!1,includeProps:!0,maxComponents:6,captureDiagnostics:!0,clearOnCopy:!1,toolbarCollapsed:!1,screenshotDelivery:"path",accentColor:q},Fe=[{value:"compact",label:"Compact",hint:"One line each"},{value:"standard",label:"Standard",hint:"Component + source"},{value:"detailed",label:"Detailed",hint:"+ classes, box, props"},{value:"forensic",label:"Forensic",hint:"Everything"}],an=[{value:"filtered",label:"Skip framework plumbing"},{value:"smart",label:"Only names matching the DOM"},{value:"all",label:"Every component"},{value:"off",label:"Off (fastest)"}],sn=[{value:"path",label:"Link to the saved file"},{value:"embed",label:"Embed in the report"}],ln=[{value:"auto",label:"Match system"},{value:"light",label:"Light"},{value:"dark",label:"Dark"}],Tt={compact:"off",standard:"filtered",detailed:"smart",forensic:"all"};function P(t){if(!t)return null;if(t.origin==="grep-handle")return`(no path \u2014 grep for \`[${t.file}]\`)`;let e=t.line?`:${t.line}`:"",n=t.line&&t.column?`:${t.column}`:"";return`${t.file}${e}${n}`}function er(t){let e=Object.entries(t??{});return e.length?e.map(([n,o])=>`${n}=${o}`).join(", "):null}function Ct(t){return`+${(t/1e3).toFixed(1)}s`}function dn(t,e){return t.length>e?`${t.slice(0,e)}\u2026`:t}function tr(t){let e=t.boundingBox;if(!e)return"";let n=Math.round;return`x:${n(e.x)}, y:${n(e.y)} (${n(e.width)}\xD7${n(e.height)}px)`}function St(t){let e=a=>a===0?"0":`${a}px`,{top:n,right:o,bottom:r,left:i}=t;return n===o&&o===r&&r===i?e(n):n===r&&i===o?`${e(n)} ${e(o)}`:`${e(n)} ${e(o)} ${e(r)} ${e(i)}`}function nr(t){let e=[`${t.width}\xD7${t.height}px`,`content ${t.content.width}\xD7${t.content.height}`],n=o=>o.top||o.right||o.bottom||o.left;return n(t.padding)&&e.push(`padding ${St(t.padding)}`),n(t.margin)&&e.push(`margin ${St(t.margin)}`),n(t.border)&&e.push(`border ${St(t.border)}`),t.scaled&&e.push("scaled"),e.join(" \xB7 ")}function cn(t){return t<0?`${-t}px overlap`:`${t}px`}function Ne(t){return t===0?"aligned":t>0?`+${t}px`:`${t}px`}function or(t,e){let n=[],o=e==="detailed"||e==="forensic",r=e==="forensic",{gap:i,box:a}=t;if(i){if(n.push(`**Measured to:** ${i.toElement} (\`${i.toSelector}\`)`),i.containment==="none")n.push(`**Gap:** ${cn(i.gap.x)} horizontal, ${cn(i.gap.y)} vertical`);else{let l=i.containment==="b-inside-a"?"the second element is inside the first":"the first element is inside the second";n.push(`**Gap:** none \u2014 ${l}`)}if(o){let{top:l,right:c,bottom:d,left:u}=i.edges;n.push(`**Edges:** top ${Ne(l)}, right ${Ne(c)}, bottom ${Ne(d)}, left ${Ne(u)}`)}if(r){let l=i.center.x===0?"aligned horizontally":`${Math.abs(i.center.x)}px ${i.center.x>0?"right":"left"}`,c=i.center.y===0?"aligned vertically":`${Math.abs(i.center.y)}px ${i.center.y>0?"down":"up"}`;n.push(`**Centres:** ${l}, ${c}`)}}return o&&a&&n.push(`**Box:** ${nr(a)}`),n}function rr(t){let e=t?.gap;return e?` \xB7 gap ${e.gap.x}\xD7${e.gap.y}px`:""}function ir(t){if(!t?.detected)return null;let e=t.flavour??t.framework??"detected",n=[t.version?`${e} ${t.version}`:e];return t.stateManager&&n.push(t.stateManager),t.devMetadata||n.push("production build \u2014 component metadata unavailable"),n.join(" \xB7 ")}function ar(t,e){let n=`${window.innerWidth}\xD7${window.innerHeight}`,o=ir(t.page),r=[`## Page feedback: ${t.pathname}`];return e==="forensic"?(r.push("","**Environment:**",`- URL: ${t.href}`),o&&r.push(`- Stack: ${o}`),t.page?.routePath&&r.push(`- Route: ${t.page.routePath}`),r.push(`- Viewport: ${n}`,`- Device pixel ratio: ${window.devicePixelRatio}`,`- User agent: ${navigator.userAgent}`,`- Captured: ${new Date().toISOString()}`,"","---")):e!=="compact"&&r.push(o?`**Stack:** ${o}  \xB7  **Viewport:** ${n}`:`**Viewport:** ${n}`),r.push(""),r}function _t(t){let e=de(t);return e==="ui"?"":`[${e}] `}function sr(t,e){let n=P(t.source),o=n?` (${n})`:"",r=t.selectedText?` \u2014 re: "${dn(t.selectedText,30)}"`:"",i=rr(t.measurements);return`${e}. ${_t(t)}**${t.element}**${o}${i}: ${t.comment}${r}`}function lr(t){if(!t.length)return[];let e=["## Already fixed",""];for(let n of t){let o=P(n.source),r=o?` (${o})`:"";e.push(`- ${_t(n)}**${n.element}**${r} \u2014 ${n.comment}`)}return e.push(""),e}function cr(t,e,n){let o=[`### ${e}. ${_t(t)}${t.element}`],r=P(t.source),i=n==="detailed"||n==="forensic",a=n==="forensic";a&&t.isMultiSelect&&o.push("*Multi-element selection \u2014 forensic detail is for the first element.*"),r&&o.push(`**Source:** ${r}`),t.framework?.path&&o.push(`**Components:** ${t.framework.path}`),a&&t.framework?.ownerComponent&&o.push(`**Owner:** <${t.framework.ownerComponent}>`);let l=er(t.framework?.props);if(i&&l&&o.push(`**Props:** ${l}`),a&&t.framework?.grepHandles.length&&o.push(`**Grep handles:** ${t.framework.grepHandles.join(", ")}`),t.frame){let c=t.frame.url?` \u2014 \`${t.frame.url}\``:"";o.push(`**Frame:** ${t.frame.label}${c}`),a&&o.push(`**Frame element:** \`${t.frame.selector}\``)}return a?(o.push(`**Selector:** \`${t.selector}\``),t.fullPath&&o.push(`**Full DOM path:** ${t.fullPath}`)):(o.push(`**Location:** ${t.elementPath}`),n==="detailed"&&o.push(`**Selector:** \`${t.selector}\``)),i&&t.cssClasses&&o.push(`**Classes:** ${t.cssClasses}`),i&&t.boundingBox&&o.push(`**Position:** ${tr(t)}`),t.measurements&&o.push(...or(t.measurements,n)),a&&o.push(`**Marker at:** ${t.x.toFixed(1)}% from left, ${Math.round(t.y)}px from top`),t.selectedText&&o.push(`**Selected text:** "${t.selectedText}"`),i&&t.nearbyText&&!t.selectedText&&o.push(`**Context:** ${dn(t.nearbyText,100)}`),a?(t.computedStyles&&o.push(`**Computed styles:** ${t.computedStyles}`),t.accessibility&&o.push(`**Accessibility:** ${t.accessibility}`),t.nearbyElements&&o.push(`**Nearby elements:** ${t.nearbyElements}`)):n==="detailed"&&t.computedStyles&&o.push(`**Computed styles:** ${t.computedStyles}`),o.push(...dr(t)),o.push(`**Feedback:** ${t.comment}`,""),o}function dr(t){if(t.screenshotData)return["**Screenshot:**","",`![${t.element.replace(/[[\]]/g,"")}](${t.screenshotData})`,""];let e=t.screenshotPath??t.screenshot;return e?[`**Screenshot:** ${e}`]:[]}var ur={click:"Clicked",input:"Edited",submit:"Submitted",key:"Pressed",navigate:"Navigated to"};function hr(t){if(!t.length)return[];let e=["## Steps to reproduce",""];return t.forEach((n,o)=>{let r=n.detail?` (${n.detail})`:"";e.push(`${o+1}. ${ur[n.kind]} ${n.target}${r}  \`${Ct(n.at)}\``)}),e.push(""),e}var pr={error:"Uncaught",rejection:"Unhandled rejection",console:"console.error",resource:"Resource"};function mr(t,e){if(!t.length)return[];let n=[`## Console errors (${t.length})`,""];for(let o of t){let r=o.source?` \u2014 ${o.source}${o.line?`:${o.line}`:""}`:"";if(n.push(`- \`${Ct(o.at)}\` **${pr[o.kind]??o.kind}:** ${o.message}${r}`),e&&o.stack){let i=o.stack.split(`
`).slice(0,8).map(a=>`  ${a.trim()}`);n.push("","  ```",...i,"  ```")}}return n.push(""),n}function gr(t){if(!t.length)return[];let e=[`## Failed requests (${t.length})`,""];for(let n of t){let o=n.status===0?"failed":String(n.status),r=n.statusText?` ${n.statusText}`:"";e.push(`- \`${Ct(n.at)}\` **${o}**${r} \u2014 ${n.method} ${n.url} (${n.durationMs}ms)`)}return e.push(""),e}function un(t,e,n="standard"){if(!t.length)return"";let o=ar(e,n),r=t.filter(u=>!F(u)),i=t.filter(u=>F(u));r.forEach((u,h)=>{n==="compact"?o.push(sr(u,h+1)):o.push(...cr(u,h+1,n))});let a=e.actions??[],l=e.diagnostics,c=l?.logs.length??0,d=l?.network.length??0;if(n==="compact"){let u=[];return c&&u.push(`${c} console error${c===1?"":"s"}`),d&&u.push(`${d} failed request${d===1?"":"s"}`),i.length&&u.unshift(`${i.length} already fixed`),u.length&&o.push("",`_Also captured: ${u.join(", ")} \u2014 switch off Compact to include them._`),o.join(`
`).trim()}if(o.push(...lr(i)),(a.length||c||d)&&(o.push("---","",...hr(a)),l)){let u=n==="detailed"||n==="forensic";o.push(...mr(l.logs,u),...gr(l.network))}return l?.unavailable&&o.push("_Console and network capture was not active on this page \u2014 reload with the extension enabled to collect them._"),o.join(`
`).trim()}var U="senannotate",hn=`${U}:request`,pn=`${U}:response`,fr=`${U}:event`,At=`${U}:frame`,$t=`data-${U}-probe`,te=`data-${U}-ui`,mn="data-v-inspector",gn=`${U}:page:`,fn=`${U}:dock:`,he=`${U}:settings`,Lt=`${U}:hide-until-restart`;function bn(t,e){return typeof t=="object"&&t!==null&&t.channel===e&&typeof t.id=="number"}function yn(t){return typeof t=="object"&&t!==null&&t.channel===fr}var vn=40,br=60;function yr(t,e){let n=t;for(;n;){let o=n.closest(e);if(o)return o;let r=n.getRootNode();if(!(r instanceof ShadowRoot))return null;n=r.host}return null}function _(t){return t?t.hasAttribute?.(te)?!0:!!yr(t,`[${te}]`):!1}var vr=/^(?=.*\d)[a-z0-9]{4,}$/i,wr=/^(css|svelte|jsx|sc)-[a-z0-9]{4,}$/i;function xr(t){if(!t||t.startsWith("__")||wr.test(t))return null;let n=t.replace(/[_-]{1,2}(?=[^_-]*$)([a-z0-9]+)$/i,(o,r)=>vr.test(r)?"":o)||t;return n.length>0?n:null}function xn(t){return Dt(t).join(" ")}function Dt(t){let e=t.getAttribute("class");if(!e)return[];let n=[];for(let o of e.trim().split(/\s+/)){let r=xr(o);r&&!n.includes(r)&&n.push(r)}return n}function Ht(t,e=2){let n=t.tagName.toLowerCase(),o=Dt(t).slice(0,e);return o.length?`${n}.${o.join(".")}`:n}function kr(t,e=4){let n=[],o=t;for(;o&&n.length<e&&!(o.tagName==="BODY"||o.tagName==="HTML");)n.unshift(Ht(o,1)),o=ze(o);return n.join(" > ")}function kn(t){let e=[],n=t;for(;n&&e.length<40&&(e.unshift(Er(n)),n.tagName!=="BODY");)n=ze(n);return e.join(" > ")}function Er(t){let e=t.tagName.toLowerCase();if(t.id)return`${e}#${t.id}`;let n=Dt(t).slice(0,2);return n.length?`${e}.${n.join(".")}`:e}function ze(t){if(t.parentElement)return t.parentElement;let e=t.getRootNode();return e instanceof ShadowRoot?e.host:null}var Mr=["data-testid","data-test","data-cy","data-qa"];function me(t){let e=t;for(;e.getRootNode()instanceof ShadowRoot;)e=e.getRootNode().host;let n=[],o=e;for(;o&&n.length<12;){let r=Tr(o);if(r)return n.unshift(r),n.join(" > ");if(o.tagName==="BODY"){n.unshift("body");break}n.unshift(Sr(o)),o=o.parentElement}return n.join(" > ")}function Tr(t){for(let e of Mr){let n=t.getAttribute(e);if(!n)continue;let o=`[${e}="${n.replace(/"/g,'\\"')}"]`;if(t.ownerDocument.querySelectorAll(o).length===1)return o}if(t.id){let e=`#${Cr(t.id)}`;if(t.ownerDocument.querySelectorAll(e).length===1)return e}return null}function Sr(t){let e=t.tagName.toLowerCase(),n=t.parentElement;if(!n)return e;let o=Array.from(n.children).filter(r=>r.tagName===t.tagName);return o.length<2?e:`${e}:nth-of-type(${o.indexOf(t)+1})`}function Cr(t){return typeof CSS<"u"&&CSS.escape?CSS.escape(t):t}var _r=new Set(["a","button","summary","label","legend","h1","h2","h3","h4","h5","h6","th","td","li","dt","dd","p","figcaption","caption","option"]);function R(t){let e=t,n=e.tagName.toLowerCase(),o=kr(e),r=Ar(e);if(r)return{name:`${n} "${pe(r,vn)}"`,path:o};if(_r.has(n)){let l=qe(e);if(l)return{name:`${n} "${pe(l,vn)}"`,path:o}}let i=$r(e);return i?{name:`${n}[${i}]`,path:o}:{name:Ht(e,2),path:o}}function Ar(t){let e=t.getAttribute("aria-label")?.trim();if(e)return e;let n=t.getAttribute("aria-labelledby");if(n){let o=n.split(/\s+/).map(r=>t.ownerDocument.getElementById(r)?.textContent?.trim()).filter(Boolean).join(" ");if(o)return o}return t instanceof HTMLImageElement&&t.alt.trim()?t.alt.trim():null}function qe(t){return(t.textContent??"").replace(/\s+/g," ").trim()}function $r(t){for(let e of["placeholder","name","type","role","href","title"]){let n=t.getAttribute(e);if(n)return`${e}="${pe(n,30)}"`}return null}function pe(t,e){return t.length>e?`${t.slice(0,e)}\u2026`:t}function En(t){let e=pe(qe(t),br),n=wn(t,"previousElementSibling"),o=wn(t,"nextElementSibling"),r=[];return n&&r.push(`[before: "${n}"]`),e&&r.push(e),o&&r.push(`[after: "${o}"]`),r.join(" ")}function wn(t,e){let n=t[e],o=0;for(;n&&o<3;){if(!_(n)){let r=qe(n);if(r)return pe(r,30)}n=n[e],o++}return""}function Mn(t){let e=ze(t);if(!e)return"";let n=[];for(let o of Array.from(e.children)){if(o===t||_(o))continue;if(n.length>=4)break;let r=Ht(o,1),i=qe(o);n.push(i?`${r} "${pe(i,24)}"`:r)}return n.join(", ")}var Lr=["color","background-color","font-size","font-weight","padding","margin","display"],Dr=["color","background-color","border-color","font-size","font-weight","font-family","text-align","width","height","padding","margin","border","border-radius","display","flex-direction","justify-content","align-items","position","z-index","opacity","overflow"];function Tn(t,e){let n=getComputedStyle(t),o=[];for(let r of e){let i=n.getPropertyValue(r).trim();if(!i||i==="none"||i==="normal"||i==="auto")continue;let a=r==="font-family"?i.split(",")[0].replace(/["']/g,""):i;o.push(`${r}: ${a}`)}return o.join("; ")}function Sn(t){return Tn(t,Lr)}function Cn(t){return Tn(t,Dr)}var Hr=new Set(["a","button","input","select","textarea","summary"]);function _n(t){let e=[],n=t.getAttribute("role");n&&e.push(`role="${n}"`);for(let l of Array.from(t.attributes))l.name.startsWith("aria-")&&e.push(`${l.name}="${l.value}"`);let o=t.tagName.toLowerCase(),r=t.getAttribute("tabindex"),i=t.hasAttribute("disabled"),a=!i&&(Hr.has(o)||!!r&&r!=="-1");return e.push(a?"focusable":"not focusable"),i&&e.push("disabled"),r&&e.push(`tabindex="${r}"`),e.join(", ")}function An(t){let e=t,n=0;for(;e&&n<40;){let o=getComputedStyle(e).position;if(o==="fixed"||o==="sticky")return!0;e=ze(e),n++}return!1}var Br=new Set(["HTML","BODY","HEAD","SCRIPT","STYLE","META","LINK","TITLE"]);function ge(t){return!(!t||!(t instanceof Element)||Br.has(t.tagName)||_(t))}function s(t,e={},...n){let o=document.createElement(t);if(e.class&&(o.className=e.class),e.title&&(o.title=e.title),e.text!==void 0&&(o.textContent=e.text),e.style&&Object.assign(o.style,e.style),e.dataset&&Object.assign(o.dataset,e.dataset),e.attrs)for(let[r,i]of Object.entries(e.attrs))o.setAttribute(r,i);if(e.on)for(let[r,i]of Object.entries(e.on))o.addEventListener(r,Rr(r,i));for(let r of n)r==null||r===!1||o.append(r);return o}var Pr=new Set(["click","mousedown","mouseup","pointerdown","pointerup"]);function Rr(t,e){return Pr.has(t)?n=>{n.isTrusted&&e(n)}:e}function Ln(t){for(;t.firstChild;)t.firstChild.remove()}function Ue(t){if(t.dataset.leaving==="true")return;t.dataset.leaving="true";let e=()=>t.remove();t.addEventListener("animationend",e,{once:!0}),window.setTimeout(e,400)}function K(t,e){let n=document.activeElement;n instanceof HTMLElement&&n!==document.body&&n!==document.documentElement&&!n.hasAttribute(te)&&n.blur(),t.focus(e)}function m(t,e,n,o){return t.addEventListener(e,n,o),()=>t.removeEventListener(e,n,o)}var $n={cursor:"M4 3l7.5 17 2.4-6.6L20.5 11z",text:"M5 5h14M9 5v14M15 5v6",marquee:"M4 8V5a1 1 0 011-1h3M20 8V5a1 1 0 00-1-1h-3M4 16v3a1 1 0 001 1h3M20 16v3a1 1 0 01-1 1h-3",snowflake:"M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M12 7l-2.2-2.2M12 7l2.2-2.2M12 17l-2.2 2.2M12 17l2.2 2.2",list:"M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",copy:"M9 9h10v10a2 2 0 01-2 2H9a2 2 0 01-2-2V9z M5 15V5a2 2 0 012-2h10",trash:"M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3",close:"M6 6l12 12M18 6L6 18",camera:"M4 8a2 2 0 012-2h1.5l1-2h7l1 2H18a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2z M12 16a3.5 3.5 0 100-7 3.5 3.5 0 000 7z",check:"M5 13l4 4L19 7",s:"M15.03 6.75A3.5 3.5 0 1 0 12 12A3.5 3.5 0 1 1 8.97 17.25",gear:"M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1A1.6 1.6 0 006 19.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003 14.9H3a2 2 0 110-4h.1A1.6 1.6 0 004.6 9l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010 4.6V4a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z",pencil:"M4 20h4L20 8a2.8 2.8 0 10-4-4L4 16z",bug:"M9 7a3 3 0 016 0M8 7h8v6a4 4 0 01-8 0zM4 11h4M16 11h4M5 6l2 2M19 6l-2 2M5 17l2.5-1.5M19 17l-2.5-1.5",chevron:"M6 9l6 6 6-6",download:"M12 4v11M8 11l4 4 4-4M5 19h14",arrows:"M3 12h18M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4",ruler:"M2 8h20v8H2z M6 8v3M10 8v3M14 8v3M18 8v3"};function b(t,e=16){let n=document.createElementNS("http://www.w3.org/2000/svg","svg");n.setAttribute("viewBox","0 0 24 24"),n.setAttribute("width",String(e)),n.setAttribute("height",String(e)),n.setAttribute("fill","none"),n.setAttribute("stroke","currentColor"),n.setAttribute("stroke-width","1.8"),n.setAttribute("stroke-linecap","round"),n.setAttribute("stroke-linejoin","round"),n.setAttribute("aria-hidden","true");let o=document.createElementNS("http://www.w3.org/2000/svg","path");return o.setAttribute("d",$n[t]??$n.cursor),n.append(o),n}var Ir=40,Or=1500,ne=[],Fr=Date.now(),Dn=!1,Bn=!1,Bt=location.href;function Pn(t){Bn=t}function Pt(){return Date.now()-Fr}function fe(t,e,n){if(Bn&&t!=="navigate")return;let o=ne[ne.length-1];if(o&&o.kind===t&&o.target===e&&t==="input"&&Pt()-o.at<Or){o.at=Pt();return}ne.push({kind:t,target:e,detail:n,at:Pt()}),ne.length>Ir&&ne.shift()}function Hn(t){let e=t.getAttribute("aria-labelledby");if(e){let i=document.getElementById(e)?.textContent?.trim();if(i)return i}let n=t.getAttribute("aria-label");if(n)return n;let o=t.getAttribute("id");if(o){let i=document.querySelector(`label[for="${CSS.escape(o)}"]`)?.textContent?.trim();if(i)return i}let r=t.closest("label")?.textContent?.trim();return r?r.slice(0,40):t.getAttribute("placeholder")||t.getAttribute("name")||t.tagName.toLowerCase()}function Rn(){Dn||(Dn=!0,m(document,"click",t=>{let e=t.target;if(!e||_(e))return;let n=e.closest?.("button, a, [role='button'], [role='link'], summary, label")??e;fe("click",R(n).name)},{capture:!0,passive:!0}),m(document,"input",t=>{let e=t.target;if(!e||_(e)||!e.matches("input, textarea, select, [contenteditable]"))return;let n=e.getAttribute("type"),o=n==="checkbox"||n==="radio"?e.checked?"checked":"unchecked":void 0;fe("input",Hn(e),o)},{capture:!0,passive:!0}),m(document,"change",t=>{let e=t.target;if(!e||_(e)||e.tagName!=="SELECT")return;let n=e.selectedOptions?.[0]?.textContent?.trim();fe("input",Hn(e),n?`selected "${n.slice(0,40)}"`:"changed")},{capture:!0,passive:!0}),m(document,"submit",t=>{let e=t.target;!e||_(e)||fe("submit",R(e).name)},{capture:!0,passive:!0}),m(document,"keydown",t=>{let e=t;if(e.key!=="Enter"&&e.key!=="Escape")return;let n=e.target;!n||_(n)||fe("key",R(n).name,e.key)},{capture:!0,passive:!0}),window.setInterval(()=>{if(location.href===Bt)return;let t=Bt;Bt=location.href,fe("navigate",location.pathname+location.search,`from ${new URL(t).pathname}`)},400))}function Rt(){return ne.slice()}function In(){ne.length=0}var Nr=500,zr=1,Ke=new Map,Fn=null;function Nn(t){Fn=t}window.addEventListener("message",t=>{if(t.source!==window)return;if(yn(t.data)){t.data.payload?.kind==="diagnostics"&&Fn?.(t.data.payload.diagnostics);return}if(!bn(t.data,pn))return;let e=Ke.get(t.data.id);e&&(Ke.delete(t.data.id),e(t.data.payload))});function Se(t){return new Promise(e=>{let n=zr++,o=!1,r=i=>{o||(o=!0,Ke.delete(n),e(i))};Ke.set(n,r),window.setTimeout(()=>r(null),Nr),window.postMessage({channel:hn,id:n,payload:t},"*")})}async function zn(){let t=await Se({kind:"detect"});return t?.kind==="detect"?t.page:null}var qr=0,On=new WeakMap,Te=new WeakMap;function Ur(t){let e=On.get(t);return e||(e=`p${qr++}`,On.set(t,e)),Te.set(t,(Te.get(t)??0)+1),t.setAttribute($t,e),e}function Kr(t){let e=(Te.get(t)??1)-1;if(e>0){Te.set(t,e);return}Te.delete(t),t.removeAttribute($t)}async function We(t,e,n,o){if(e==="off")return null;let r=Ur(t);try{let i=await Se({kind:"inspect",probeId:r,mode:e,maxComponents:n,includeProps:o});return i?.kind==="inspect"?i.info:null}finally{Kr(t)}}async function qn(t){await Se({kind:t?"freeze":"unfreeze"})}async function Un(){let t=await Se({kind:"diagnostics"});return t?.kind==="diagnostics"?t.diagnostics:null}async function Kn(){await Se({kind:"clear-diagnostics"})}function Wr(t){let e=t,n=0;for(;e&&n<30;){let o=e.getAttribute(mn);if(o){let r=Gr(o);if(r)return r}e=e.parentElement,n++}return null}function Gr(t){let e=t.match(/^(.*?):(\d+):(\d+)$/);if(e)return{file:e[1],line:Number(e[2]),column:Number(e[3]),origin:"dom-attr"};let n=t.match(/^(.*?):(\d+)$/);return n?{file:n[1],line:Number(n[2]),origin:"dom-attr"}:t?{file:t,origin:"dom-attr"}:null}function Ge(t,e){if(e?.source?.precision==="exact")return{file:e.source.file,line:e.source.line,column:e.source.column,origin:"exact"};let n=Wr(t),o=e?.source?{file:e.source.file,origin:"file"}:null;if(n&&o)return Wn(n.file)===Wn(o.file)?n:o;if(n)return n;if(o)return o;let r=e?.grepHandles?.[0];return r?{file:r,origin:"grep-handle"}:null}function Wn(t){return t.split("/").pop()??t}function Gn(t){let e=t.getBoundingClientRect();return{x:e.left+window.scrollX,y:e.top+window.scrollY,width:e.width,height:e.height}}async function Ce(t,e){let[n]=t;if(!n)return null;let{settings:o}=e,{name:r,path:i}=R(n),a=n.getBoundingClientRect(),l=An(n),c=await We(n,o.componentMode,o.maxComponents,o.includeProps),d=Ge(n,c),u=t.length>1,h=o.detailLevel,T=h==="detailed"||h==="forensic",L=h==="forensic",D={element:u?`${r} +${t.length-1} more`:r,elementPath:i,selector:me(n),x:a.right/window.innerWidth*100,y:l?a.top:a.top+window.scrollY,isFixed:l,boundingBox:Gn(n),elementBoundingBoxes:u?t.map(Gn):void 0,isMultiSelect:u||void 0,measurements:e.measurements,selectedText:e.selectedText,cssClasses:xn(n)||void 0,framework:c??void 0,source:d??void 0};return T&&(D.nearbyText=En(n)||void 0,D.computedStyles=L?Cn(n)||void 0:Sn(n)||void 0),L&&(D.fullPath=kn(n),D.nearbyElements=Mn(n)||void 0,D.accessibility=_n(n)||void 0),D}function be(t){return(t.elementBoundingBoxes??(t.boundingBox?[t.boundingBox]:[])).map(n=>{let o=t.isFixed?n.x:n.x-window.scrollX,r=t.isFixed?n.y:n.y-window.scrollY;return new DOMRect(o,r,n.width,n.height)})}function It(t){try{let r=document.querySelector(t.selector);if(r)return r}catch{}let e=t.boundingBox;if(!e)return null;let n=e.x-window.scrollX+e.width/2,o=e.y-window.scrollY+e.height/2;return n<0||o<0||n>window.innerWidth||o>window.innerHeight?null:document.elementFromPoint(n,o)}async function jn(t,e){try{return await navigator.clipboard.writeText(t),!0}catch{}try{let n=document.createElement("textarea");n.value=t,n.setAttribute("readonly",""),Object.assign(n.style,{position:"fixed",top:"0",left:"0",width:"1px",height:"1px",opacity:"0",pointerEvents:"auto"}),e.append(n),K(n),n.select();let o=document.execCommand("copy");return n.remove(),o}catch{return!1}}var Xn=6,ye=class{constructor(e){this.boxes=[];this.layer=e,this.marquee=s("div",{class:"marquee",style:{display:"none"}}),e.append(this.marquee)}showHighlights(e,n,o){let r=o?.preview??!1;for(;this.boxes.length<e.length;){let i=s("div",{class:"highlight"});this.boxes.push(i),this.layer.append(i)}for(let i=e.length;i<this.boxes.length;i++)this.boxes[i].style.display="none",this.boxes[i].classList.remove("highlight--muted","highlight--preview");e.forEach((i,a)=>{let l=this.boxes[a];if(l.style.display="block",l.style.left=`${i.left}px`,l.style.top=`${i.top}px`,l.style.width=`${i.width}px`,l.style.height=`${i.height}px`,l.classList.toggle("highlight--muted",!r&&a>0),l.classList.toggle("highlight--preview",r),l.replaceChildren(),a===0&&n){let c=this.buildLabel(i,n);l.append(c),this.clampLabel(c,i)}})}clampLabel(e,n){let o=n.left+e.offsetWidth-(window.innerWidth-Xn);if(o<=0)return;let r=Math.min(o,Math.max(0,n.left-Xn));r>0&&(e.style.left=`${-r}px`)}buildLabel(e,n){let o=s("div",{class:"highlight__label"},s("span",{text:n.primary}),n.secondary?s("span",{class:"highlight__source",text:n.secondary}):null);return e.top<26&&(o.dataset.flip="true"),o}hideHighlights(){for(let e of this.boxes)e.style.display="none"}showMarquee(e){this.marquee.style.display="block",this.marquee.style.left=`${e.left}px`,this.marquee.style.top=`${e.top}px`,this.marquee.style.width=`${e.width}px`,this.marquee.style.height=`${e.height}px`}hideMarquee(){this.marquee.style.display="none"}hideAll(){this.hideHighlights(),this.hideMarquee()}};var Yn=`/* ==========================================================================
   SenAnnotate overlay styles \u2014 injected into a shadow root
   --------------------------------------------------------------------------
   Everything here is scoped by the shadow boundary, so the page's stylesheet
   cannot reach in and ours cannot leak out. The only thing that does cross is
   inherited properties, which \`:host\` resets.
   ========================================================================== */

:host {
  /* Reset anything the page might have set on our host element. */
  all: initial;

  --sa-accent: #f97316;
  --sa-accent-strong: #ea580c;
  --sa-accent-ink: #431407;

  --sa-bg: rgba(255, 255, 255, 0.86);
  --sa-bg-solid: #ffffff;
  --sa-bg-sunken: #f4f5f7;
  --sa-fg: #1c2530;
  --sa-fg-muted: #64748b;
  --sa-border: rgba(20, 30, 45, 0.12);
  --sa-shadow: 0 8px 32px rgba(15, 25, 40, 0.18), 0 1px 2px rgba(15, 25, 40, 0.1);

  --sa-radius: 12px;
  --sa-radius-sm: 8px;
  --sa-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --sa-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;

  position: fixed;
  inset: 0;
  z-index: 2147483647;
  pointer-events: none;
  font-family: var(--sa-font);
  font-size: 13px;
  line-height: 1.45;
  color: var(--sa-fg);
  -webkit-font-smoothing: antialiased;
}

:host([data-theme="dark"]) {
  --sa-bg: rgba(22, 27, 34, 0.88);
  --sa-bg-solid: #161b22;
  --sa-bg-sunken: #0d1117;
  --sa-fg: #e6edf3;
  --sa-fg-muted: #8b949e;
  --sa-border: rgba(240, 246, 252, 0.14);
  --sa-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.4);
}

* {
  box-sizing: border-box;
}

button {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  padding: 0;
  margin: 0;
  cursor: pointer;
}

/* ==========================================================================
   Toolbar
   ========================================================================== */

.toolbar-dock {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  pointer-events: none;
}

/*
 * Dragged out of the corner. \`bottom\`/\`right\` have to be released explicitly or they
 * keep fighting the inline \`left\`/\`top\` and the pill stretches between the two.
 */
.toolbar-dock[data-floating="true"] {
  bottom: auto;
  right: auto;
  align-items: flex-start;
}

/* Near the top there is no room above the pill for the hint, so it goes underneath. */
.toolbar-dock[data-hint-below="true"] {
  flex-direction: column-reverse;
}

/*
 * \`.tool\` is listed alongside the pill because those are \`<button>\`s, matched directly by
 * \`button { cursor: pointer }\` above \u2014 and a direct match beats an inherited value, so
 * without this the grab cursor only ever appears on the pill's 5px of padding and the 2px
 * gaps between buttons. The whole pill being the handle is the feature.
 */
.toolbar-dock .toolbar,
.toolbar-dock .toolbar .tool {
  cursor: grab;
}

/*
 * Without this the browser claims the gesture for panning and answers with
 * \`pointercancel\`, so the drag does not work by touch or pen *at all*. Everything else
 * here is already touch-ready \u2014 Pointer Events, implicit capture on touch, a
 * \`pointercancel\` handler \u2014 and this one declaration is the whole difference.
 */
.toolbar-dock .toolbar {
  touch-action: none;
}

/*
 * Held on the whole dock, not the pill: the pointer is captured for the duration and
 * leaves the toolbar constantly during a fast drag, and a cursor that reverts
 * mid-gesture reads as the drag having been dropped.
 */
.toolbar-dock[data-dragging="true"],
.toolbar-dock[data-dragging="true"] .toolbar,
.toolbar-dock[data-dragging="true"] .tool {
  cursor: grabbing;
}

/* Nothing should animate under the pointer while it is being dragged. */
.toolbar-dock[data-dragging="true"] .toolbar {
  transition: none;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px;
  border-radius: 14px;
  background: var(--sa-bg);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  border: 1px solid var(--sa-border);
  box-shadow: var(--sa-shadow);
  pointer-events: auto;
  user-select: none;
  /* The last three are the collapse: the pill morphs into the handle. */
  transition:
    transform 0.18s ease,
    opacity 0.18s ease,
    padding 0.16s ease,
    gap 0.16s ease,
    border-radius 0.16s ease;
}

/*
 * Sits above the pill, not below it \u2014 the toolbar is pinned to the bottom of
 * the viewport, so there is nothing below it to sit in.
 */
/*
 * \`point\` mode's hint is the longest line the overlay draws \u2014 five clauses, about 470px at
 * 11px \u2014 and a 340px ceiling with \`nowrap\` overflowed it to the right, off the screen edge,
 * since the dock is right-aligned. The last two clauses (\`2 text \xB7 3 area\`) were the ones
 * lost, which is exactly the part the hint exists to advertise.
 *
 * Widened and clamped to the viewport rather than allowed to wrap: the cards above are
 * lifted by a fixed 104px when inspecting (see \`~ .settings\` below), so a second hint line
 * would put the toolbar back under the settings card. Ellipsis is the graceful end for a
 * viewport too narrow even for that \u2014 visibly truncated beats silently off screen.
 */
.toolbar-hint {
  max-width: min(520px, calc(100vw - 40px));
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 3px 9px;
  border-radius: 8px;
  background: var(--sa-bg);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  border: 1px solid var(--sa-border);
  color: var(--sa-fg-muted);
  font-size: 11px;
  white-space: nowrap;
  user-select: none;
  font-variant-numeric: tabular-nums;
}

.tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  min-width: 32px;
  padding: 0 8px;
  border-radius: var(--sa-radius-sm);
  color: var(--sa-fg-muted);
  transition: background 0.13s ease, color 0.13s ease;
}

.tool:hover {
  background: color-mix(in srgb, var(--sa-fg) 8%, transparent);
  color: var(--sa-fg);
}

.tool[aria-pressed="true"] {
  background: var(--sa-accent);
  color: var(--sa-accent-ink);
}

.tool[disabled] {
  opacity: 0.35;
  cursor: not-allowed;
}

.tool--brand {
  padding-left: 6px;
  color: var(--sa-accent);
}

.tool--brand[aria-pressed="true"] {
  color: var(--sa-accent-ink);
}

.tool__label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

/* ==========================================================================
   Collapsed toolbar
   ========================================================================== */

/*
 * \`!important\` is load-bearing, not decoration. \`Toolbar.update()\` writes \`display\`
 * inline on the stack badge, the mode group, the count and the hint line, and an
 * author \`!important\` declaration is what outranks a normal one in a style attribute.
 *
 * The pill itself stays visible and becomes the handle. Hiding \`.toolbar\` outright
 * would take away the only way back \u2014 and ten e2e scenarios wait on it being visible.
 */
.toolbar-dock[data-collapsed="true"] .toolbar-hint {
  display: none !important;
}

/*
 * Folded rather than \`display: none\`d, so the pill can shrink into the handle instead
 * of snapping. \`max-width\` and not \`width\`: \`auto\` is not an interpolable value, so a
 * width transition on an auto-sized button animates nothing. The ceiling only has to
 * clear the widest child; the cost of it being generous is a short lead-in.
 *
 * \`visibility\` closes the gap \`max-width: 0\` leaves \u2014 a zero-width button is off screen
 * but still in the tab order. It is transitioned with a delay so it lands *after* the
 * fold rather than blanking the contents on the first frame, and \`0s\` in the base rule
 * so expanding brings them straight back.
 */
.toolbar > :not(.tool--collapse) {
  max-width: 240px;
  transition:
    max-width 0.16s ease,
    padding 0.16s ease,
    opacity 0.12s ease,
    visibility 0s;
}

.toolbar-dock[data-collapsed="true"] .toolbar > :not(.tool--collapse) {
  max-width: 0 !important;
  min-width: 0 !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
  border-left-width: 0 !important;
  border-right-width: 0 !important;
  margin: 0 !important;
  opacity: 0 !important;
  overflow: hidden !important;
  visibility: hidden !important;
  transition:
    max-width 0.16s ease,
    padding 0.16s ease,
    opacity 0.12s ease,
    visibility 0s linear 0.16s !important;
}

/* \`gap\` too, or every folded child would still leave its 2px behind. */
.toolbar-dock[data-collapsed="true"] .toolbar {
  padding: 3px;
  border-radius: 999px;
  gap: 0;
}

/*
 * Circular to match the pill it has become. Without this the hover fill and the
 * browser's keyboard focus ring stay rounded-square, and a square ring drawn around
 * a round handle reads as a rendering bug rather than as focus.
 */
.toolbar-dock[data-collapsed="true"] .tool--collapse {
  position: relative;
  border-radius: 999px;
  color: var(--sa-accent);
}

/*
 * Collapsing must not cost you the count. Deliberately not the \`.count\` class: an
 * e2e assertion reads \`.count\` by itself, and a second element under that name would
 * make the locator ambiguous.
 */
.handle-count {
  position: absolute;
  top: -3px;
  right: -3px;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  border: 1.5px solid var(--sa-bg-solid);
  background: var(--sa-accent);
  color: var(--sa-accent-ink);
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  pointer-events: none;
}

/* Down rotated counter-clockwise points right, in a y-down coordinate system: \`\xBB\`,
   the direction the pill folds away in, being docked to the right edge. */
.tool--collapse .tool__icon--collapse {
  transform: rotate(-90deg);
}

.tool--collapse .tool__icon--expand {
  display: none;
}

.toolbar-dock[data-collapsed="true"] .tool--collapse .tool__icon--collapse {
  display: none;
}

.toolbar-dock[data-collapsed="true"] .tool--collapse .tool__icon--expand {
  display: block;
}

.divider {
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: var(--sa-border);
}

.count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--sa-accent);
  color: var(--sa-accent-ink);
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.stack-badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 11px;
  background: color-mix(in srgb, var(--sa-accent) 16%, transparent);
  color: var(--sa-accent-strong);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.stack-badge[data-warn="true"] {
  background: color-mix(in srgb, #f59e0b 18%, transparent);
  color: #b45309;
}

/*
 * With an orange accent, amber alone no longer reads as a warning \u2014 it sits too
 * close in hue to the brand icon right beside it. Differentiate by form instead of
 * re-tinting: red is already the destructive colour, and a stripped production build
 * is a degraded capability, not an error. A pseudo-element keeps this out of
 * \`textContent\`, which three e2e assertions read.
 */
.stack-badge[data-warn="true"]::before {
  content: "\u26A0";
  margin-right: 4px;
}

:host([data-theme="dark"]) .stack-badge[data-warn="true"] {
  color: #fbbf24;
}

/* ==========================================================================
   Hover highlight + marquee
   ========================================================================== */

.highlight {
  position: fixed;
  pointer-events: none;
  border: 1.5px solid var(--sa-accent);
  border-radius: 3px;
  background: color-mix(in srgb, var(--sa-accent) 10%, transparent);
  transition: all 0.07s linear;
}

.highlight--muted {
  border-style: dashed;
  border-color: var(--sa-fg-muted);
  background: color-mix(in srgb, var(--sa-fg-muted) 8%, transparent);
}

/*
 * Boxes drawn while the marquee is being dragged. No transition: a pooled box
 * reused for a different element would otherwise animate across the page at
 * drag speed, which reads as the selection sliding around rather than changing.
 */
.highlight--preview {
  transition: none;
}

.highlight__label {
  position: absolute;
  left: 0;
  top: -22px;
  display: flex;
  align-items: center;
  gap: 6px;
  /* The viewport term matters on a narrow window, where 480px alone is wider than the
     screen and no amount of shifting could bring the label fully into view. */
  max-width: min(480px, calc(100vw - 12px));
  padding: 2px 7px;
  border-radius: 5px;
  background: var(--sa-accent);
  color: var(--sa-accent-ink);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.highlight__label[data-flip="true"] {
  top: auto;
  bottom: -22px;
}

.highlight__source {
  font-family: var(--sa-mono);
  font-weight: 500;
  opacity: 0.78;
}

.marquee {
  position: fixed;
  pointer-events: none;
  border: 1.5px dashed var(--sa-accent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--sa-accent) 12%, transparent);
}

/* ---------------------------------------------------------------------------
 * Measurement overlay
 *
 * The band colours are the one place in this UI that does NOT derive from
 * \`--sa-accent\`. The padding band and the margin band have to be distinguishable
 * from each other, and two shades derived from an arbitrary colour the user picked
 * cannot guarantee that. Fixed green and orange, translucent enough to read the page
 * through. See \`docs/measure-core/context.md\`.
 * ------------------------------------------------------------------------- */

/*
 * A figure written on the band it measures. Only drawn on bands thick enough to hold
 * it \u2014 see \`LABEL_MIN_THICKNESS\`; the readout below carries the rest.
 */
.measure-band-label {
  position: fixed;
  pointer-events: none;
  transform: translate(-50%, -50%);
  color: #0b3b2e;
  font-size: 9px;
  font-weight: 700;
  font-family: var(--sa-mono);
  line-height: 1;
  white-space: nowrap;
}

/*
 * The properties the bands cannot say. Deliberately six short rows rather than a
 * scrollable computed-style table: this sits over someone else's page, and a panel
 * large enough to need scrolling is a panel that has stopped being an overlay.
 */
.measure-readout {
  position: fixed;
  pointer-events: none;
  display: grid;
  gap: 1px;
  padding: 5px 7px;
  border-radius: 5px;
  /* Solid, not \`--sa-bg\`: this panel lands on top of whatever the page is showing, and
     a translucent one lets the page text through the figures it is there to make
     readable. Same variable every real card uses. */
  background: var(--sa-bg-solid);
  color: var(--sa-fg);
  border: 1px solid var(--sa-border);
  box-shadow: var(--sa-shadow);
  font-size: 10px;
  font-family: var(--sa-mono);
  line-height: 14px;
  white-space: nowrap;
}

.measure-readout__row {
  display: flex;
  align-items: center;
  gap: 5px;
}

/* Ties a row to the band it describes \u2014 the only reason those two colours are fixed. */
/*
 * Fixed widths, so the four side cells line up between the padding row and the margin
 * row. Without that the eye has to re-find the columns on every row, which is most of
 * what makes a shorthand hard to read in the first place.
 */
.measure-readout__key {
  min-width: 48px;
}

.measure-readout__side {
  min-width: 34px;
}

/*
 * This side's figure is already drawn on its band, on the page. Dimming it is the point
 * of the row: what stays at full weight is exactly what the page could not tell you.
 */
.measure-readout__side--drawn {
  opacity: 0.4;
}

.measure-readout__dot {
  width: 6px;
  height: 6px;
  border-radius: 2px;
  flex: none;
}

.measure-readout__dot--padding {
  background: rgba(16, 185, 129, 0.9);
}

.measure-readout__dot--margin {
  background: rgba(249, 115, 22, 0.9);
}

.measure-line {
  position: fixed;
  pointer-events: none;
  background: var(--sa-accent);
}

.measure-label {
  position: fixed;
  pointer-events: none;
  /* Centred on its point without a layout read \u2014 the alternative is measuring
     offsetWidth on every pointermove. */
  transform: translate(-50%, -50%);
  padding: 0 4px;
  border-radius: 3px;
  background: var(--sa-accent);
  color: var(--sa-accent-ink);
  font-size: 10px;
  font-weight: 600;
  font-family: var(--sa-mono);
  line-height: 15px;
  white-space: nowrap;
}

/* ==========================================================================
   Markers
   ========================================================================== */

.markers {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

.marker {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: -12px 0 0 -12px;
  border-radius: 50% 50% 50% 3px;
  background: var(--sa-accent);
  color: var(--sa-accent-ink);
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 2px 8px rgba(15, 25, 40, 0.3);
  pointer-events: auto;
  cursor: pointer;
  transition: transform 0.13s ease;
  will-change: transform;
}

.marker:hover {
  z-index: 2;
}

.marker__dot {
  transition: transform 0.13s ease;
}

.marker:hover .marker__dot {
  transform: scale(1.18);
}

/* ==========================================================================
   Cards \u2014 shared shell for the composer and the panel
   ========================================================================== */

.card {
  position: fixed;
  display: flex;
  flex-direction: column;
  border-radius: var(--sa-radius);
  background: var(--sa-bg-solid);
  border: 1px solid var(--sa-border);
  box-shadow: var(--sa-shadow);
  pointer-events: auto;
  overflow: hidden;
}

.card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--sa-border);
}

.card__title {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card__body {
  /* Grow to fill a fixed-height card (the panel) and scroll when it overflows;
     \`min-height: 0\` is what lets a flex child actually shrink below its content.
     On an auto-height card (the composer) this is a no-op. */
  flex: 1 1 auto;
  min-height: 0;
  padding: 12px;
  overflow-y: auto;
}

.card__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--sa-border);
  background: var(--sa-bg-sunken);
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: var(--sa-fg-muted);
  flex: none;
}

.icon-button:hover {
  background: color-mix(in srgb, var(--sa-fg) 9%, transparent);
  color: var(--sa-fg);
}

/* ==========================================================================
   Composer
   ========================================================================== */

.composer {
  width: 380px;
  max-width: calc(100vw - 24px);
}

.composer__meta {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 10px;
}

.meta-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 11.5px;
}

.meta-row__key {
  flex: none;
  width: 66px;
  color: var(--sa-fg-muted);
  font-weight: 600;
}

.meta-row__value {
  min-width: 0;
  flex: 1;
  font-family: var(--sa-mono);
  font-size: 11px;
  word-break: break-word;
}

.meta-row__value--accent {
  color: var(--sa-accent-strong);
  font-weight: 600;
}

:host([data-theme="dark"]) .meta-row__value--accent {
  color: var(--sa-accent);
}

/*
 * Retarget controls, sitting on the Element row they change.
 *
 * \`flex: none\` and \`align-self: center\` because \`.meta-row\` aligns on the baseline \u2014
 * correct for two runs of text, wrong for a row of buttons, which would hang below it.
 */
.retarget {
  flex: none;
  align-self: center;
  display: inline-flex;
  gap: 1px;
  padding: 1px;
  border-radius: 7px;
  background: var(--sa-bg-sunken);
}

/*
 * \`.icon-button\` carries the box, the colour and the hover; this only narrows it. Sharing
 * the rule is what keeps the hover tint and any future focus ring identical to the
 * footer's buttons instead of drifting apart by a percent at a time.
 *
 * Smaller than the 26px default because these sit inside an 11.5px text row \u2014 but not as
 * small as they could be: with the arrow keys off once the note has text, they are the
 * only way to retarget from then on, so they stay a real target.
 */
.retarget__button {
  width: 22px;
  height: 22px;
  font-size: 11px;
  line-height: 1;
  transition: background 0.13s ease, color 0.13s ease;
}

.composer__input {
  width: 100%;
  min-height: 76px;
  max-height: 240px;
  padding: 9px 10px;
  border: 1px solid var(--sa-border);
  border-radius: var(--sa-radius-sm);
  background: var(--sa-bg-sunken);
  color: var(--sa-fg);
  font: inherit;
  resize: vertical;
  outline: none;
}

.composer__input:focus {
  border-color: var(--sa-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--sa-accent) 22%, transparent);
}

.composer__input::placeholder {
  color: var(--sa-fg-muted);
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border-radius: var(--sa-radius-sm);
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
  transition: background 0.13s ease, border-color 0.13s ease;
}

.button--primary {
  background: var(--sa-accent);
  color: var(--sa-accent-ink);
}

.button--primary:hover {
  background: var(--sa-accent-strong);
}

.button--ghost {
  color: var(--sa-fg-muted);
  border-color: var(--sa-border);
}

.button--ghost:hover {
  color: var(--sa-fg);
  background: color-mix(in srgb, var(--sa-fg) 6%, transparent);
}

.button--danger:hover {
  color: #e5484d;
  border-color: color-mix(in srgb, #e5484d 40%, transparent);
  background: color-mix(in srgb, #e5484d 10%, transparent);
}

.spacer {
  flex: 1;
}

.hint {
  color: var(--sa-fg-muted);
  font-size: 11px;
}

kbd {
  padding: 1px 4px;
  border: 1px solid var(--sa-border);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: var(--sa-bg-sunken);
  font-family: var(--sa-mono);
  font-size: 10px;
}

/* ==========================================================================
   Panel
   ========================================================================== */

.panel {
  top: 20px;
  right: 20px;
  bottom: 72px;
  width: 380px;
  max-width: calc(100vw - 24px);
  /*
   * An animation rather than a transition, for the same reason the toast uses one:
   * it runs on insertion with no second frame to arrange. \`@starting-style\` would be
   * the modern way to transition in, and it is Chrome 117 \u2014 this project floors at 111.
   */
  animation: vt-rise 0.16s ease;
}

/*
 * Same clearance the settings card needs, and for the same reason: inspect mode adds
 * the hint line above the pill, making the dock ~32px taller, and a panel stopping at
 * 72px covers it \u2014 measured at 22px. The two rules are kept separate rather than
 * grouped because the cards do not otherwise share a positioning rule, and grouping
 * them would imply a shared anchor they do not have: the panel is pinned top *and*
 * bottom, the settings card only bottom.
 */
.toolbar-dock[data-inspecting="true"] ~ .panel {
  bottom: 104px;
}

/*
 * The tail of a close. \`Panel.destroy\` sets this, then removes the node when the
 * animation ends; \`forwards\` holds the last frame so there is no flash back to full
 * opacity in between.
 */
.panel[data-leaving="true"] {
  animation: vt-fall 0.14s ease forwards;
  pointer-events: none;
}

.capture-summary {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
  padding: 7px 9px;
  border: 1px solid color-mix(in srgb, var(--sa-accent) 35%, transparent);
  border-radius: var(--sa-radius-sm);
  background: color-mix(in srgb, var(--sa-accent) 10%, transparent);
  color: var(--sa-accent-strong);
  font-size: 11.5px;
  font-weight: 600;
}

:host([data-theme="dark"]) .capture-summary {
  color: var(--sa-accent);
}

.panel__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.entry {
  display: flex;
  gap: 9px;
  padding: 9px 10px;
  border: 1px solid var(--sa-border);
  border-radius: var(--sa-radius-sm);
  background: var(--sa-bg-sunken);
  cursor: pointer;
  transition: border-color 0.13s ease;
}

.entry:hover {
  border-color: var(--sa-accent);
}

.entry__number {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 19px;
  height: 19px;
  border-radius: 50%;
  background: var(--sa-accent);
  color: var(--sa-accent-ink);
  font-size: 10.5px;
  font-weight: 700;
}

.entry__body {
  flex: 1;
  min-width: 0;
}

.entry__element {
  font-weight: 600;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry__source {
  margin-top: 1px;
  color: var(--sa-accent-strong);
  font-family: var(--sa-mono);
  font-size: 10.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:host([data-theme="dark"]) .entry__source {
  color: var(--sa-accent);
}

.entry__comment {
  margin-top: 3px;
  color: var(--sa-fg-muted);
  font-size: 11.5px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.empty {
  padding: 28px 12px;
  text-align: center;
  color: var(--sa-fg-muted);
  font-size: 12px;
}

.select {
  /* Shrinkable, and allowed below its intrinsic width: the widest option
     ("Detailed \u2014 + classes, box, props") is 215px of a 356px footer, so anything
     added beside it pushes the Copy button past the card's \`overflow: hidden\` edge.
     Measured, not guessed \u2014 see docs/annotation-triage/changelog.md. */
  flex: 0 1 auto;
  min-width: 0;
  height: 26px;
  padding: 0 6px;
  border: 1px solid var(--sa-border);
  border-radius: 6px;
  background: var(--sa-bg-solid);
  color: var(--sa-fg);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
  outline: none;
}

.select:focus {
  border-color: var(--sa-accent);
}

/* ==========================================================================
   Triage \u2014 type and status
   --------------------------------------------------------------------------
   Type is a hue, status is opacity. Two independent channels, so a done bug still
   reads as a bug. \`ui\` deliberately keeps the existing accent: it is the default
   every unlabelled note lands on, and the panel should look unchanged for anyone
   who never touches the chips.
   ========================================================================== */

.kind-chip,
.entry,
.marker {
  --sa-kind: var(--sa-accent);
}

[data-kind="bug"] {
  --sa-kind: #ef4444;
}

[data-kind="copy"] {
  --sa-kind: #3b82f6;
}

[data-kind="question"] {
  --sa-kind: #8b5cf6;
}

.composer__kinds {
  display: flex;
  gap: 4px;
  margin: 0 0 8px;
}

.kind-chip {
  flex: 1;
  height: 24px;
  padding: 0 6px;
  border-radius: 6px;
  border: 1px solid var(--sa-border);
  font-size: 11px;
  font-weight: 600;
  color: var(--sa-fg-muted);
  cursor: pointer;
  transition: background 0.13s ease, color 0.13s ease, border-color 0.13s ease;
}

.kind-chip:hover {
  border-color: var(--sa-kind);
  color: var(--sa-fg);
}

.kind-chip[aria-pressed="true"] {
  background: var(--sa-kind);
  border-color: var(--sa-kind);
  color: #fff;
}

.panel__filter {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}

.panel__filter-button {
  height: 22px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid var(--sa-border);
  font-size: 11px;
  font-weight: 600;
  color: var(--sa-fg-muted);
  cursor: pointer;
}

.panel__filter-button[aria-pressed="true"] {
  background: var(--sa-fg);
  border-color: var(--sa-fg);
  color: var(--sa-bg-solid);
}

/* The number badge carries the hue in the list, where a whole coloured row would
   fight the comment text for attention. */
.entry__number {
  color: var(--sa-kind);
}

.entry__status {
  flex: none;
  align-self: flex-start;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 5px;
  border: 1px solid var(--sa-border);
  color: transparent;
  cursor: pointer;
  transition: background 0.13s ease, color 0.13s ease, border-color 0.13s ease;
}

.entry__status:hover {
  border-color: var(--sa-fg-muted);
  color: var(--sa-fg-muted);
}

.entry__status[aria-pressed="true"] {
  background: var(--sa-accent);
  border-color: var(--sa-accent);
  color: #fff;
}

.entry[data-done="true"] .entry__element,
.entry[data-done="true"] .entry__comment {
  text-decoration: line-through;
  opacity: 0.55;
}

.marker[data-kind] {
  background: var(--sa-kind);
  /* The accent's ink is tuned for orange; the other three are dark enough that
     white is the only readable choice. */
  color: #fff;
}

.marker[data-kind="ui"] {
  color: var(--sa-accent-ink);
}

.marker[data-done="true"] {
  opacity: 0.45;
  box-shadow: none;
}

/* ==========================================================================
   Screenshot markup editor
   --------------------------------------------------------------------------
   Centred rather than anchored to the element: by the time it opens the shot is
   already taken, so there is nothing on the page left to point at, and the crop
   can be any shape at all.
   ========================================================================== */

.shot-editor {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  max-width: calc(100vw - 32px);
}

.shot-editor__tools {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
}

.shot-tool {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 9px;
  border-radius: 6px;
  border: 1px solid var(--sa-border);
  font-size: 11.5px;
  font-weight: 550;
  color: var(--sa-fg-muted);
  cursor: pointer;
  transition: background 0.13s ease, color 0.13s ease, border-color 0.13s ease;
}

.shot-tool:hover:not(:disabled) {
  background: var(--sa-bg-sunken);
  color: var(--sa-fg);
}

.shot-tool[aria-pressed="true"] {
  background: var(--sa-accent);
  border-color: var(--sa-accent);
  color: #fff;
}

.shot-tool:disabled {
  opacity: 0.4;
  cursor: default;
}

/* Last tool button is Undo; push it away from the drawing tools. */
.shot-tool:last-child {
  margin-left: auto;
}

.shot-editor__stage {
  display: flex;
  justify-content: center;
  padding: 8px;
  border-radius: var(--sa-radius-sm);
  background: var(--sa-bg-sunken);
  border: 1px solid var(--sa-border);
}

.shot-editor__canvas {
  display: block;
  max-width: 100%;
  border-radius: 4px;
  /* Crosshair, because every tool is a drag \u2014 and \`touch-action: none\` so a
     trackpad or touchscreen drag draws instead of scrolling the page under us. */
  cursor: crosshair;
  touch-action: none;
}

/* ==========================================================================
   Toast
   ========================================================================== */

.toast {
  position: fixed;
  /* Bottom-left, deliberately: the toolbar owns the bottom-right and the panel
     owns the right edge, so anywhere over there collides with the button you
     just pressed. */
  bottom: 20px;
  left: 20px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  border-radius: var(--sa-radius-sm);
  background: var(--sa-bg-solid);
  border: 1px solid var(--sa-border);
  box-shadow: var(--sa-shadow);
  font-size: 12px;
  font-weight: 550;
  pointer-events: none;
  animation: vt-rise 0.2s ease;
}

.toast[data-tone="success"] {
  color: var(--sa-accent-strong);
}

.toast[data-tone="error"] {
  color: #e5484d;
}

/* -----------------------------------------------------------------------------
 * Settings card
 * -------------------------------------------------------------------------- */

/*
 * Same corner as the panel, which is why the two are mutually exclusive.
 *
 * Anchored to \`bottom\`, not \`top\`, and pinned to neither end. The panel is a list that
 * grows and earns the full height; this is a fixed set of rows, so it sizes to its
 * content and sits just above the toolbar that opened it \u2014 the pointer is already there,
 * and a card that opens at the far end of the screen from its own button reads as
 * belonging to something else. \`max-height\` catches the case where the rows outgrow the
 * viewport and hands the overflow to the body.
 */
.settings {
  bottom: 72px;
  right: 20px;
  width: 380px;
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 92px);
  animation: vt-rise 0.16s ease;
}

/*
 * Inspect mode adds the hint line above the pill, making the dock ~32px taller, and the
 * card would otherwise cover it. A sibling selector because the dock is not an ancestor:
 * \`createTopUi\` builds the Toolbar before any card exists, so \`.toolbar-dock\` is always
 * an earlier sibling in the card layer. If that order ever changes the symptom is a
 * 22px overlap, not a crash \u2014 but it is the reason this cannot be a descendant rule.
 */
.toolbar-dock[data-inspecting="true"] ~ .settings {
  bottom: 104px;
}

/*
 * A dragged dock is not in the corner any more, so there is no hint line for the cards
 * to clear and the extra 32px is a gap under them for nothing. Both cards, one rule:
 * here the anchor genuinely is shared \u2014 it is the dock's absence from the corner.
 */
.toolbar-dock[data-floating="true"] ~ .panel,
.toolbar-dock[data-floating="true"] ~ .settings {
  bottom: 20px;
}

/*
 * Anchored to the dock's measured box by \`SettingsCard.anchorTo\`, which writes \`left\` and
 * \`top\`. \`bottom\` and \`right\` have to be released explicitly or the card stretches between
 * the two pairs \u2014 the same trap \`.toolbar-dock[data-floating="true"]\` above documents, and
 * here it reads as a card that grows when the pill is dragged.
 *
 * Written to out-specify the two rules above it rather than to stand alone: both are
 * \`.toolbar-dock[\u2026] ~ .settings\`, three class-column points to this selector's four.
 * The hint-line clearance is not replaced by anything, because the anchored card does not
 * need it \u2014 the hint is a child of the dock, so it is inside the box being measured.
 */
.toolbar-dock[data-floating="true"] ~ .settings[data-anchored="true"] {
  bottom: auto;
  right: auto;
}

.settings[data-leaving="true"] {
  animation: vt-fall 0.14s ease forwards;
  pointer-events: none;
}

.settings__body {
  overflow-y: auto;
}

/* Right-aligned and quiet: it is a fact to look up, not something to read past. */
.settings__footer {
  justify-content: flex-end;
  padding: 7px 12px;
}

.settings__version {
  color: var(--sa-fg-muted);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.settings__group {
  margin: 14px 0 6px;
  color: var(--sa-fg-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.settings__group:first-child {
  margin-top: 0;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 30px;
}

.setting-row__label {
  display: inline-flex;
  align-items: center;
  color: var(--sa-fg);
  font-size: 12px;
}

.setting-row__control {
  flex: none;
  max-width: 200px;
}

.accent-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

/*
 * The accent row, ported from the popup along with its reasoning: presets for one
 * click, a picker for an exact brand colour, and a way back to the shipped orange.
 * The variable names differ between the two worlds \u2014 \`--sa-*\` here, \`--*\` there \u2014
 * which is the same split that made \`shared/accent.ts\` return colours rather than
 * variable names.
 */
.swatches {
  display: flex;
  gap: 4px;
}

.swatch {
  width: 16px;
  height: 16px;
  padding: 0;
  border: 1px solid var(--sa-border);
  border-radius: 50%;
  cursor: pointer;
}

/* A ring rather than a border swap, so the swatch's own colour never changes size or
   shade when it becomes the selected one. */
.swatch[aria-pressed="true"] {
  box-shadow: 0 0 0 2px var(--sa-bg-solid), 0 0 0 3.5px var(--sa-accent);
}

.accent-custom {
  width: 22px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--sa-border);
  border-radius: 5px;
  background: none;
  cursor: pointer;
}

.link-button {
  padding: 0;
  border: 0;
  background: none;
  color: var(--sa-fg-muted);
  font: inherit;
  font-size: 11px;
  text-decoration: underline;
  cursor: pointer;
}

.link-button:hover {
  color: var(--sa-fg);
}

/* -----------------------------------------------------------------------------
 * Tooltips
 * -------------------------------------------------------------------------- */

.tooltip {
  position: fixed;
  z-index: 3;
  max-width: 240px;
  padding: 5px 8px;
  border-radius: var(--sa-radius-sm);
  background: var(--sa-bg-solid);
  border: 1px solid var(--sa-border);
  box-shadow: var(--sa-shadow);
  color: var(--sa-fg);
  font-size: 11px;
  line-height: 1.45;
  /* Wraps, unlike the toolbar hint: these are sentences, not a status line. */
  white-space: normal;
  pointer-events: none;
  animation: vt-rise 0.12s ease;
}

/*
 * A button, never a span \u2014 the sentence it holds is the only explanation of what the
 * setting does, so a keyboard has to be able to reach it.
 */
.hint-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  margin-left: 5px;
  padding: 0;
  border: 1px solid var(--sa-border);
  border-radius: 999px;
  background: transparent;
  color: var(--sa-fg-muted);
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  cursor: help;
  transition: color 0.13s ease, border-color 0.13s ease;
}

.hint-dot:hover,
.hint-dot:focus-visible {
  color: var(--sa-accent-strong);
  border-color: var(--sa-accent);
}

/* -----------------------------------------------------------------------------
 * Toggle switch
 * -------------------------------------------------------------------------- */

/*
 * The native checkbox stays, and stays operable \u2014 it is the accessible control and the
 * one the keyboard and the e2e suite drive. It is only moved out of sight beneath the
 * track it draws, rather than replaced.
 */
.switch {
  position: relative;
  display: inline-flex;
  flex: none;
  width: 34px;
  height: 20px;
}

.switch input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.switch__track {
  flex: 1;
  border-radius: 999px;
  background: var(--sa-border);
  transition: background 0.16s ease;
  pointer-events: none;
}

.switch__track::after {
  content: "";
  display: block;
  width: 14px;
  height: 14px;
  margin: 3px;
  border-radius: 999px;
  background: var(--sa-bg-solid);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.3);
  transition: transform 0.16s ease;
}

.switch input:checked + .switch__track {
  background: var(--sa-accent);
}

.switch input:checked + .switch__track::after {
  transform: translateX(14px);
}

.switch input:focus-visible + .switch__track {
  outline: 2px solid var(--sa-accent);
  outline-offset: 2px;
}

@keyframes vt-rise {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Only \`to\`: an exit has to start from wherever the element actually is. */
@keyframes vt-fall {
  to {
    opacity: 0;
    transform: translateY(6px);
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
  }
}
`;function je(){let t=document.createElement("div");t.setAttribute(te,""),t.style.setProperty("position","fixed","important"),t.style.setProperty("inset","0","important"),t.style.setProperty("pointer-events","none","important"),t.style.setProperty("z-index","2147483647","important");let e=t.attachShadow({mode:"open"}),n=new CSSStyleSheet;n.replaceSync(Yn),e.adoptedStyleSheets=[n];let o=s("div",{class:"layer layer--overlay"}),r=s("div",{class:"markers"}),i=s("div",{class:"layer layer--cards"});e.append(o,r,i);let a=()=>{let f=document.querySelectorAll(":modal");for(let C=f.length-1;C>=0;C-=1){let H=f[C];if(H&&H!==t&&!t.contains(H))return H}return null},l=()=>{t.style.setProperty("inset","0","important"),t.style.removeProperty("width"),t.style.removeProperty("height"),t.style.removeProperty("transform");let f=document.documentElement.clientWidth,C=document.documentElement.clientHeight,H=t.getBoundingClientRect(),ce=(Et,Vo)=>Math.abs(Et-Vo)>=1;!ce(H.left,0)&&!ce(H.top,0)&&!ce(H.width,f)&&!ce(H.height,C)||(t.style.setProperty("transform","translate(0)","important"),t.style.setProperty("inset","auto","important"),t.style.setProperty("left",`${-H.left}px`,"important"),t.style.setProperty("top",`${-H.top}px`,"important"),t.style.setProperty("width",`${f}px`,"important"),t.style.setProperty("height",`${C}px`,"important"))},c=new MutationObserver(()=>{t.isConnected||d()}),d=()=>{let f=a()??document.documentElement;t.parentElement!==f&&(f.append(t),c.disconnect(),f!==document.documentElement&&c.observe(f,{childList:!0})),l()};d();let u=new MutationObserver(d);u.observe(document.documentElement,{subtree:!0,attributes:!0,attributeFilter:["open"]}),document.addEventListener("fullscreenchange",d,!0);for(let f of["pointerdown","pointerup","mousedown","mouseup","click","dblclick","contextmenu","touchstart","touchend"])t.addEventListener(f,C=>C.stopPropagation());t.addEventListener("mousedown",f=>{let C=f.composedPath()[0];C instanceof Element&&C.closest("input, textarea, select, [contenteditable]")||f.preventDefault()});for(let f of["focusin","focusout"])t.addEventListener(f,C=>C.stopPropagation());let h=window.matchMedia("(prefers-color-scheme: dark)"),T="auto",L=()=>{let f=T==="dark"||T==="auto"&&h.matches;t.setAttribute("data-theme",f?"dark":"light")};h.addEventListener("change",L),L();let D=f=>{if(f===q){for(let Et of["--sa-accent","--sa-accent-strong","--sa-accent-ink"])t.style.removeProperty(Et);return}let{accent:C,strong:H,ink:ce}=Oe(f);t.style.setProperty("--sa-accent",C),t.style.setProperty("--sa-accent-strong",H),t.style.setProperty("--sa-accent-ink",ce)},O=null,Y;return{host:t,shadow:e,overlayLayer:o,markerLayer:r,cardLayer:i,setTheme(f){T=f,L()},setAccent:D,toast:(f,C="success")=>{O?.remove(),window.clearTimeout(Y),O=s("div",{class:"toast",dataset:{tone:C}},b(C==="success"?"check":"close",14),s("span",{text:f})),i.append(O),Y=window.setTimeout(()=>{O?.remove(),O=null},2200)},syncPlacement:d,destroy(){h.removeEventListener("change",L),u.disconnect(),c.disconnect(),document.removeEventListener("fullscreenchange",d,!0),window.clearTimeout(Y),t.remove()}}}var Vn=50;function Zn(t){return typeof t=="object"&&t!==null&&t.channel===At}function Jn(){try{return window.top===window}catch{return!1}}function Xr(){try{return window.parent===window.top&&window.parent!==window}catch{return!1}}function eo(){return Xr()?window.innerWidth>=Vn&&window.innerHeight>=Vn:!1}var Ot=new Set;function to(t){if(!(t instanceof HTMLIFrameElement))return!1;let e=t.contentWindow;return e!==null&&Ot.has(e)}function Yr(t){for(let e of document.querySelectorAll("iframe")){let n=e.contentWindow;n&&t(n)}}function Ye(t,e){Yr(n=>Xe(n,{kind:"state",active:t,mode:e}))}function no(t){if(!(t instanceof HTMLIFrameElement))return!1;let e=t.contentWindow;return!e||!Ot.has(e)?!1:(Xe(e,{kind:"capture-hover"}),!0)}function Xe(t,e){try{t.postMessage({channel:At,payload:e},"*")}catch{}}function Vr(t){if(!t)return null;for(let e of document.querySelectorAll("iframe"))if(e.contentWindow===t)return e;return null}function Qr(t){let e=t.getAttribute("src")??"",n=t.getAttribute("name")||t.getAttribute("title")||"";if(!n&&e)try{n=new URL(e,location.href).pathname}catch{n=e}return{label:(n||"iframe").slice(0,80),url:e.slice(0,300),selector:me(t)}}function Qn(t,e,n){return{x:t.x+e,y:t.y+n,width:t.width,height:t.height}}function oo(t){window.addEventListener("message",e=>{if(!Zn(e.data))return;let n=Vr(e.source);if(!n)return;let o=e.data.payload;if(o?.kind==="hello"){n.contentWindow&&Ot.add(n.contentWindow);return}if(o?.kind!=="draft"||!o.draft)return;let r=n.getBoundingClientRect(),i=r.left+window.scrollX-o.scrollX,a=r.top+window.scrollY-o.scrollY,l=o.draft,c=l.boundingBox?Qn(l.boundingBox,i,a):void 0;t({...l,isFixed:!1,boundingBox:c,elementBoundingBoxes:l.elementBoundingBoxes?.map(d=>Qn(d,i,a)),x:c?(c.x+c.width-window.scrollX)/window.innerWidth*100:50,y:c?c.y:window.scrollY,frame:Qr(n)})})}function ro(t){let e=!1,n="point",o=null,r=je(),i=new ye(r.overlayLayer),a=u=>ge(u)&&!_(u),l=()=>{i.hideHighlights(),o=null},c=async(u,h)=>{let T=await Ce([u],{settings:t(),selectedText:h});T&&(Xe(window.parent,{kind:"draft",draft:T,scrollX:window.scrollX,scrollY:window.scrollY}),l())};window.addEventListener("message",u=>{if(!Zn(u.data)||u.source!==window.parent)return;let h=u.data.payload;if(h?.kind==="capture-hover"){o?.isConnected&&c(o);return}h?.kind==="state"&&(e=h.active,n=h.mode,e?document.body?.style.setProperty("cursor","crosshair","important"):(document.body?.style.removeProperty("cursor"),l()))}),m(document,"pointermove",u=>{if(!e||n!=="point")return;let h=document.elementFromPoint(u.clientX,u.clientY);if(!h||!a(h)){l();return}h!==o&&(o=h,i.showHighlights([h.getBoundingClientRect()],{primary:R(h).name}))},{passive:!0}),m(document,"click",u=>{if(!e||n==="text"||_(u.target)||(u.preventDefault(),u.stopPropagation(),n!=="point"))return;let h=document.elementFromPoint(u.clientX,u.clientY);!h||!a(h)||c(h)},{capture:!0});for(let u of["mousedown","mouseup"])m(document,u,h=>{!e||n==="text"||_(h.target)||(h.preventDefault(),h.stopPropagation())},{capture:!0});m(document,"mouseup",()=>{!e||n!=="text"||window.setTimeout(()=>{let u=window.getSelection(),h=u?.toString().trim();if(!u||!h)return;let T=u.getRangeAt(0).commonAncestorContainer,L=T.nodeType===Node.ELEMENT_NODE?T:T.parentElement;!L||!a(L)||c(L,h)},0)}),m(document,"keydown",u=>{let h=u;if(!e||n!=="point"||h.metaKey||h.ctrlKey||h.altKey||h.key!=="c"&&h.key!=="C"&&h.key!=="Enter")return;let T=h.target;T?.isContentEditable||T&&/^(input|textarea|select)$/i.test(T.tagName)||o?.isConnected&&c(o)});let d=()=>Xe(window.parent,{kind:"hello"});d(),window.setTimeout(d,300),window.setTimeout(d,1200)}async function io(t,e){try{let n=await Zr(t),o=n.width/window.innerWidth,r=Math.max(0,Math.round((e.left-8)*o)),i=Math.max(0,Math.round((e.top-8)*o)),a=Math.min(n.width-r,Math.round((e.width+8*2)*o)),l=Math.min(n.height-i,Math.round((e.height+8*2)*o));if(a<=0||l<=0)return null;let c=document.createElement("canvas");c.width=a,c.height=l;let d=c.getContext("2d");return d?(d.drawImage(n,r,i,a,l,0,0,a,l),c):null}catch{return null}}function ao(t){return new Promise(e=>t.toBlob(e,"image/png"))}function so(t){try{if(t.width<=900)return t.toDataURL("image/jpeg",.72);let e=900/t.width,n=document.createElement("canvas");n.width=900,n.height=Math.max(1,Math.round(t.height*e));let o=n.getContext("2d");return o?(o.imageSmoothingQuality="high",o.drawImage(t,0,0,n.width,n.height),n.toDataURL("image/jpeg",.72)):null}catch{return null}}function Ft(t,e){try{let n=URL.createObjectURL(t),o=document.createElement("a");return o.href=n,o.download=e,o.style.display="none",document.body.append(o),o.click(),o.remove(),window.setTimeout(()=>URL.revokeObjectURL(n),1e4),!0}catch{return!1}}function lo(t){return`~/Downloads/${t}`}function Zr(t){return new Promise((e,n)=>{let o=new Image;o.onload=()=>e(o),o.onerror=()=>n(new Error("could not decode the captured tab")),o.src=t})}function uo(){return`${gn}${location.origin}${location.pathname}`}async function ho(){try{let t=uo(),n=(await chrome.storage.local.get(t))[t];return Array.isArray(n)?n:[]}catch{return[]}}var co=4e6;function Jr(t){let e=JSON.stringify(t).length;if(e<=co)return{payload:t,dropped:0};let n=t.map(r=>({...r})),o=0;for(let r of n){if(e<=co)break;r.screenshotData&&(e-=r.screenshotData.length,delete r.screenshotData,o+=1)}return{payload:n,dropped:o}}async function po(t){try{let e=uo();if(!t.length)return await chrome.storage.local.remove(e),{ok:!0,droppedImages:0};let{payload:n,dropped:o}=Jr(t);return await chrome.storage.local.set({[e]:n}),{ok:!0,droppedImages:o}}catch{return{ok:!1,droppedImages:0}}}function mo(){return`${fn}${location.origin}${location.pathname}`}async function go(){try{let t=mo(),e=(await chrome.storage.local.get(t))[t];if(typeof e!="object"||e===null)return null;let{x:n,y:o}=e;return!Number.isFinite(n)||!Number.isFinite(o)?null:{x:n,y:o}}catch{return null}}async function fo(t){try{await chrome.storage.local.set({[mo()]:t})}catch{}}async function Ve(){try{let t=await chrome.storage.sync.get(he);return{...ue,...t[he]??{}}}catch{return{...ue}}}async function Qe(t){try{await chrome.storage.sync.set({[he]:t})}catch{}}function bo(t){chrome.storage.onChanged.addListener((e,n)=>{n!=="sync"||!e[he]||t({...ue,...e[he].newValue??{}})})}var yo=380,vo=12,V=12,wo=[{direction:"parent",key:"ArrowUp",glyph:"\u2191",title:"Select the parent (\u2191)"},{direction:"child",key:"ArrowDown",glyph:"\u2193",title:"Select the first child (\u2193)"},{direction:"previous",key:"ArrowLeft",glyph:"\u2190",title:"Previous sibling (\u2190)"},{direction:"next",key:"ArrowRight",glyph:"\u2192",title:"Next sibling (\u2192)"}],Ze=class{constructor(e,n,o,r){this.teardown=[];this.kindButtons=new Map;this.callbacks=r,this.anchor=n,this.kind=o.initialKind??"ui",this.textarea=s("textarea",{class:"composer__input",attrs:{placeholder:"What should change here?",rows:"3","aria-label":"Annotation comment"}}),this.textarea.value=o.initialComment??"";for(let{value:c,label:d,hint:u}of rn)this.kindButtons.set(c,s("button",{class:"kind-chip",title:u,text:d,dataset:{kind:c},attrs:{"aria-pressed":String(c===this.kind)},on:{click:()=>this.selectKind(c)}}));let i=s("div",{class:"composer__kinds"},...this.kindButtons.values());this.meta=s("div",{class:"composer__meta"}),this.renderMeta(o);let a=s("button",{class:"button button--primary",on:{click:()=>this.submit()}},s("span",{text:o.initialComment!==void 0?"Save":"Add note"})),l=s("div",{class:"card__footer"},s("span",{class:"hint",text:"\u2318/Ctrl + Enter"}),s("span",{class:"spacer"}),this.callbacks.onDelete?s("button",{class:"button button--ghost button--danger",title:"Delete annotation",on:{click:()=>this.callbacks.onDelete?.()}},b("trash",14)):null,s("button",{class:"button button--ghost",title:"Capture a screenshot of this element",on:{click:()=>this.callbacks.onScreenshot()}},b("camera",14)),a);this.element=s("div",{class:"card composer"},s("div",{class:"card__header"},b("pencil",14),s("span",{class:"card__title",text:"Annotation"}),s("button",{class:"icon-button",title:"Cancel (Esc)",on:{click:()=>this.callbacks.onCancel()}},b("close",14))),s("div",{class:"card__body"},this.meta,i,this.textarea),l),e.append(this.element),this.position(n),this.teardown.push(m(this.element,"keydown",c=>{let d=c;if(d.isComposing||(d.key==="Escape"&&(d.preventDefault(),d.stopPropagation(),this.callbacks.onCancel()),d.key==="Enter"&&(d.metaKey||d.ctrlKey)&&(d.preventDefault(),this.submit()),!this.callbacks.onRetarget||this.textarea.value.trim().length>0)||d.metaKey||d.ctrlKey||d.altKey||d.shiftKey)return;let u=wo.find(h=>h.key===d.key);if(u){if(d.repeat){d.preventDefault();return}d.preventDefault(),this.callbacks.onRetarget(u.direction)}}));for(let c of["keydown","keyup","keypress"])this.teardown.push(m(this.element,c,d=>d.stopPropagation()));K(this.textarea)}focus(){K(this.textarea)}selectKind(e){this.kind=e;for(let[n,o]of this.kindButtons)o.setAttribute("aria-pressed",String(n===e));K(this.textarea)}submit(){let e=this.textarea.value.trim();if(!e){K(this.textarea);return}this.callbacks.onSubmit(e,this.kind)}renderMeta(e){this.meta.replaceChildren();let n=this.metaRow("Element",e.title);this.callbacks.onRetarget&&n.append(this.retargetControls()),this.meta.append(n),e.elementCount&&e.elementCount>1&&this.meta.append(this.metaRow("Selection",`${e.elementCount} elements`)),e.source&&this.meta.append(this.metaRow("Source",e.source,!0)),e.components&&this.meta.append(this.metaRow("Component",e.components)),e.props&&this.meta.append(this.metaRow("Props",e.props)),e.selectedText&&this.meta.append(this.metaRow("Text",`"${e.selectedText}"`))}retargetControls(){return s("div",{class:"retarget"},...wo.map(({direction:e,glyph:n,title:o})=>s("button",{class:"icon-button retarget__button",title:o,text:n,attrs:{"aria-label":o},on:{click:()=>{this.callbacks.onRetarget?.(e),K(this.textarea)}}})))}setData(e){this.renderMeta(e),this.position(this.anchor)}metaRow(e,n,o=!1){return s("div",{class:"meta-row"},s("span",{class:"meta-row__key",text:e}),s("span",{class:o?"meta-row__value meta-row__value--accent":"meta-row__value",text:n}))}position(e){let n=this.element.offsetHeight||260,o=e.left;o+yo>window.innerWidth-V&&(o=window.innerWidth-yo-V),o<V&&(o=V);let r=e.bottom+vo;if(r+n>window.innerHeight-V){let i=e.top-n-vo;r=i>=V?i:Math.max(V,window.innerHeight-n-V)}this.element.style.left=`${o}px`,this.element.style.top=`${r}px`}destroy(){for(let e of this.teardown)e();this.element.remove()}};var Je=class{constructor(e,n){this.pins=new Map;this.annotations=[];this.visible=!0;this.layer=e,this.callbacks=n}render(e,n){this.annotations=e,this.visible=n;let o=new Set(e.map(r=>r.id));for(let[r,i]of this.pins)o.has(r)||(i.remove(),this.pins.delete(r));e.forEach((r,i)=>{let a=this.pins.get(r.id);a||(a=s("button",{class:"marker",on:{click:c=>{c.stopPropagation(),this.callbacks.onClick(r)},mouseenter:()=>this.callbacks.onHoverChange(r),mouseleave:()=>this.callbacks.onHoverChange(null)}}),a.append(s("span",{class:"marker__dot"})),this.pins.set(r.id,a),this.layer.append(a));let l=a.firstElementChild;l.textContent=String(i+1),a.title=r.comment,a.style.display=n?"flex":"none",a.dataset.kind=de(r),a.dataset.done=String(F(r))}),this.syncPositions()}syncPositions(){if(this.visible)for(let e of this.annotations){let n=this.pins.get(e.id);if(!n)continue;let o=e.x/100*window.innerWidth,r=e.isFixed?e.y:e.y-window.scrollY,i=r<-40||r>window.innerHeight+40;n.style.visibility=i?"hidden":"visible",n.style.transform=`translate3d(${Math.round(o)}px, ${Math.round(r)}px, 0)`}}destroy(){for(let e of this.pins.values())e.remove();this.pins.clear()}};var _e=6,G=30,et=1;function xo(){let t=window.scrollX,e=window.scrollY,n=[];for(let o of Array.from(document.body.querySelectorAll("*"))){if(!ge(o))continue;let r=o.getBoundingClientRect();r.width===0||r.height===0||n.push({element:o,rect:{left:r.left+t,top:r.top+e,right:r.right+t,bottom:r.bottom+e}})}return n}function ko(t,e){if(e.right-e.left<_e||e.bottom-e.top<_e)return{elements:[],rects:[],capped:!1};let n=[];for(let a of t){let{rect:l}=a;l.left>=e.left-et&&l.top>=e.top-et&&l.right<=e.right+et&&l.bottom<=e.bottom+et&&n.push(a)}let o=new Set(n.map(({element:a})=>a)),r=n.filter(({element:a})=>{for(let l=a.parentElement;l;l=l.parentElement)if(o.has(l))return!1;return!0}),i=r.slice(0,G);return{elements:i.map(({element:a})=>a),rects:i.map(({rect:a})=>a),capped:r.length>G}}function Nt(t){return{left:t.left-window.scrollX,top:t.top-window.scrollY,width:t.right-t.left,height:t.bottom-t.top}}function $(t){let e=Math.round(t*100)/100;return e===0?0:e}function tt(t){let e=Number.parseFloat(t);return Number.isFinite(e)?e:0}function zt(t,e,n=""){return{top:$(tt(t.getPropertyValue(`${e}-top${n}`))),right:$(tt(t.getPropertyValue(`${e}-right${n}`))),bottom:$(tt(t.getPropertyValue(`${e}-bottom${n}`))),left:$(tt(t.getPropertyValue(`${e}-left${n}`)))}}function nt(t,e=getComputedStyle(t)){let n=zt(e,"padding"),o=zt(e,"border","-width"),r=zt(e,"margin"),i=t.getBoundingClientRect(),a=$(i.width),l=$(i.height),c={width:$(i.width-n.left-n.right-o.left-o.right),height:$(i.height-n.top-n.bottom-o.top-o.bottom)},d=t instanceof HTMLElement?{width:t.offsetWidth,height:t.offsetHeight}:null,u=d!==null&&(Math.abs(i.width-d.width)>1||Math.abs(i.height-d.height)>1);return{width:a,height:l,content:c,padding:n,border:o,margin:r,scaled:u}}function Eo(t,e){return e.left>=t.left&&e.right<=t.right&&e.top>=t.top&&e.bottom<=t.bottom}function Ut(t,e){let n={x:$(-(Math.min(t.right,e.right)-Math.max(t.left,e.left))),y:$(-(Math.min(t.bottom,e.bottom)-Math.max(t.top,e.top)))},o={top:$(e.top-t.top),right:$(e.right-t.right),bottom:$(e.bottom-t.bottom),left:$(e.left-t.left)},r={x:$((e.left+e.right)/2-(t.left+t.right)/2),y:$((e.top+e.bottom)/2-(t.top+t.bottom)/2)},i="none";return Eo(t,e)?i="b-inside-a":Eo(e,t)&&(i="a-inside-b"),{gap:n,edges:o,center:r,containment:i}}var ei=/^rgba?\(([^)]+)\)$/;function qt(t){let e=ei.exec(t.trim());if(!e)return t;let n=e[1].split(",").map(a=>Number.parseFloat(a));if(n.length<3||n.some(a=>!Number.isFinite(a)))return t;let o=n.length>3?n[3]:1;if(o===0)return"transparent";let r=a=>Math.max(0,Math.min(255,Math.round(a))).toString(16).padStart(2,"0"),i=`#${r(n[0])}${r(n[1])}${r(n[2])}`;return o===1?i:`${i}${r(o*255)}`}function ti(t){let e=t,n=!1;for(;e;){let o=getComputedStyle(e);if(o.backgroundImage!=="none")return{color:qt(o.backgroundColor),inherited:n,image:!0};let r=qt(o.backgroundColor);if(r!=="transparent")return{color:r,inherited:n,image:!1};e=e.parentElement,n=!0}return{color:"transparent",inherited:!1,image:!1}}function Mo(t,e=getComputedStyle(t)){let n=ti(t),o=e.fontFamily.split(",")[0].replace(/["']/g,"").trim(),r=e.borderRadius;return{fontSize:e.fontSize,lineHeight:e.lineHeight,fontFamily:o,fontWeight:e.fontWeight,color:qt(e.color),background:n.color,backgroundInherited:n.inherited,backgroundIsImage:n.image,display:e.display,radius:r==="0px"?"":r}}var ni=[{value:"all",label:"All"},{value:"open",label:"Open"},{value:"done",label:"Done"}],ot=class{constructor(e,n){this.filterButtons=new Map;this.filter="all";this.annotations=[];this.detailLevel="standard";this.callbacks=n,this.list=s("div",{class:"panel__list"}),this.summary=s("div",{class:"capture-summary",style:{display:"none"}}),this.select=s("select",{class:"select",title:"How much detail to include in the copied report",on:{change:()=>n.onDetailChange(this.select.value)}});for(let o of Fe){let r=s("option",{text:`${o.label} \u2014 ${o.hint}`});r.value=o.value,this.select.append(r)}for(let{value:o,label:r}of ni)this.filterButtons.set(o,s("button",{class:"panel__filter-button",text:r,attrs:{"aria-pressed":String(o===this.filter)},on:{click:()=>this.setFilter(o)}}));this.copyButton=s("button",{class:"button button--primary",on:{click:()=>n.onCopy()}},b("copy",14),s("span",{text:"Copy report"})),this.element=s("div",{class:"card panel"},s("div",{class:"card__header"},b("list",14),s("span",{class:"card__title",text:"Annotations"}),s("button",{class:"icon-button",title:"Download the report as a .md file",on:{click:()=>n.onDownload()}},b("download",14)),s("button",{class:"icon-button",title:"Clear all annotations on this page",on:{click:()=>n.onClearAll()}},b("trash",14)),s("button",{class:"icon-button",title:"Close (A)",on:{click:()=>n.onClose()}},b("close",14))),s("div",{class:"card__body"},this.summary,s("div",{class:"panel__filter"},...this.filterButtons.values()),this.list),s("div",{class:"card__footer"},this.select,s("span",{class:"spacer"}),this.copyButton));for(let o of e.querySelectorAll('.panel[data-leaving="true"]'))o.remove();e.append(this.element)}setFilter(e){this.filter=e;for(let[n,o]of this.filterButtons)o.setAttribute("aria-pressed",String(n===e));this.render(this.annotations,this.detailLevel)}visible(e){return this.filter==="open"?e.filter(n=>!F(n)):this.filter==="done"?e.filter(n=>F(n)):e}render(e,n){let{callbacks:o}=this;this.annotations=e,this.detailLevel=n,this.select.value=n,this.copyButton.disabled=e.length===0,Ln(this.list);let r=this.visible(e);if(!r.length){this.list.append(s("div",{class:"empty",text:e.length?"Nothing in this filter.":"No annotations yet. Turn on inspect mode and click something."}));return}for(let i of r){let a=e.indexOf(i)+1,l=P(i.source),c=F(i),d=s("div",{class:"entry__body"},s("div",{class:"entry__element",text:i.element}),l?s("div",{class:"entry__source",text:l}):null,s("div",{class:"entry__comment",text:i.comment})),u=s("button",{class:"entry__status",title:c?"Mark as still open":"Mark as done",attrs:{"aria-pressed":String(c)},on:{click:h=>{h.stopPropagation(),o.onToggleStatus(i)}}},b("check",12));this.list.append(s("div",{class:"entry",dataset:{kind:de(i),done:String(c)},on:{click:()=>o.onSelect(i),mouseenter:()=>o.onHoverChange(i),mouseleave:()=>o.onHoverChange(null)}},s("span",{class:"entry__number",text:String(a)}),d,u))}}renderCaptureSummary(e){let n=[];if(e.logs&&n.push(`${e.logs} console error${e.logs===1?"":"s"}`),e.requests&&n.push(`${e.requests} failed request${e.requests===1?"":"s"}`),e.actions&&n.push(`${e.actions} step${e.actions===1?"":"s"}`),!n.length){this.summary.style.display="none";return}this.summary.style.display="flex",this.summary.replaceChildren(b("bug",13),s("span",{text:`Captured: ${n.join(" \xB7 ")}`})),this.summary.title="Included automatically when you copy the report"}destroy(){Ue(this.element)}};var oi=14;function To(t,e){let n=()=>s("div",{class:`measure-band measure-band--${e}`,style:{display:"none"}}),o=[n(),n(),n(),n()];return t.append(...o),o}function oe(t,e,n,o,r){if(o<=0||r<=0){t.style.display="none";return}t.style.display="block",t.style.left=`${e}px`,t.style.top=`${n}px`,t.style.width=`${o}px`,t.style.height=`${r}px`}function ve(...t){for(let e of t)e.style.display="none"}var rt=class{constructor(e){this.bandLabels=[];this.anchored=null;this.margin=To(e,"margin"),this.padding=To(e,"padding"),this.anchorBox=s("div",{class:"measure-anchor",style:{display:"none"}}),this.badge=s("div",{class:"measure-badge",style:{display:"none"}});for(let n=0;n<8;n++)this.bandLabels.push(s("div",{class:"measure-band-label",style:{display:"none"}}));this.readout=s("div",{class:"measure-readout",style:{display:"none"}}),this.lineH=s("div",{class:"measure-line",style:{display:"none"}}),this.lineV=s("div",{class:"measure-line measure-line--v",style:{display:"none"}}),this.labelH=s("div",{class:"measure-label",style:{display:"none"}}),this.labelV=s("div",{class:"measure-label",style:{display:"none"}}),e.append(this.anchorBox,this.badge,...this.bandLabels,this.readout,this.lineH,this.lineV,this.labelH,this.labelV)}get anchor(){return this.anchored&&!this.anchored.isConnected&&(this.anchored=null),this.anchored}setAnchor(e){if(this.anchored=e,!e){ve(this.anchorBox),this.hideGap();return}this.syncAnchor()}syncAnchor(){let e=this.anchor;if(!e)return;let n=e.getBoundingClientRect();oe(this.anchorBox,n.left,n.top,n.width,n.height)}showBox(e,n,o){let r={margin:this.paintBand(this.margin,e,n.margin,"outside",4),padding:this.paintBand(this.padding,this.paddingBox(e,n.border),n.padding,"inside",0)};this.paintReadout(e,n,o,r),this.badge.style.display="block",this.badge.textContent=n.scaled?`${n.width}\xD7${n.height} (scaled)`:`${n.width}\xD7${n.height}`,this.badge.style.left=`${e.left}px`;let i=e.bottom+4,a=i+18<window.innerHeight;this.badge.style.top=`${a?i:Math.max(0,e.top-20)}px`}hideBox(){ve(...this.margin,...this.padding,...this.bandLabels,this.badge,this.readout)}paintReadout(e,n,o,r){let i=[],a=h=>h.top||h.right||h.bottom||h.left;a(n.padding)&&i.push(this.sideRow("padding",n.padding,r.padding)),a(n.margin)&&i.push(this.sideRow("margin",n.margin,r.margin)),a(n.border)&&i.push(this.textRow(`border ${ri(n.border)}`));let l=o.lineHeight==="normal"?"":`/${o.lineHeight}`;i.push(this.textRow(`${o.fontSize}${l} ${o.fontFamily} ${o.fontWeight}`));let c=o.backgroundIsImage?"image":o.backgroundInherited?`${o.background} (inherited)`:o.background;i.push(this.textRow(`${o.color} on ${c}`));let d=[o.display,o.radius&&`radius ${o.radius}`].filter(Boolean);i.push(this.textRow(d.join(" \xB7 "))),this.readout.replaceChildren(...i),this.readout.style.display="block",this.readout.style.left=`${Math.max(0,e.left)}px`;let u=e.bottom+24;this.readout.style.top=`${u+76<window.innerHeight?u:Math.max(0,e.top-96)}px`}paddingBox(e,n){let o=e.left+n.left,r=e.top+n.top,i=e.width-n.left-n.right,a=e.height-n.top-n.bottom;return{left:o,top:r,width:i,height:a,right:o+i,bottom:r+a}}paintBand(e,n,o,r,i){let[a,l,c,d]=e,u=r==="outside",h=u?n.left-o.left:n.left,T=u?n.width+o.left+o.right:n.width;oe(a,h,u?n.top-o.top:n.top,T,o.top),oe(c,h,u?n.bottom:n.bottom-o.bottom,T,o.bottom),oe(d,u?n.left-o.left:n.left,n.top,o.left,n.height),oe(l,u?n.right:n.right-o.right,n.top,o.right,n.height);let L=[o.top,o.right,o.bottom,o.left],D=[!1,!1,!1,!1];return e.forEach((O,Y)=>{let Ie=this.bandLabels[i+Y];if(O.style.display==="none"||L[Y]<oi){Ie.style.display="none";return}D[Y]=!0;let f={left:Number.parseFloat(O.style.left),top:Number.parseFloat(O.style.top),width:Number.parseFloat(O.style.width),height:Number.parseFloat(O.style.height)};this.label(Ie,String(L[Y]),f.left+f.width/2,f.top+f.height/2),Ie.className="measure-band-label"}),{top:D[0],right:D[1],bottom:D[2],left:D[3]}}showGap(e,n,o){let{gap:r}=o;if(r.x>0){let i=Math.min(e.right,n.right),l=Math.min(e.bottom,n.bottom)>Math.max(e.top,n.top)?(Math.max(e.top,n.top)+Math.min(e.bottom,n.bottom))/2:(e.top+e.bottom+n.top+n.bottom)/4;oe(this.lineH,i,l,r.x,1),this.label(this.labelH,`${r.x}px`,i+r.x/2,l)}else ve(this.lineH,this.labelH);if(r.y>0){let i=Math.min(e.bottom,n.bottom),l=Math.min(e.right,n.right)>Math.max(e.left,n.left)?(Math.max(e.left,n.left)+Math.min(e.right,n.right))/2:(e.left+e.right+n.left+n.right)/4;oe(this.lineV,l,i,1,r.y),this.label(this.labelV,`${r.y}px`,l,i+r.y/2)}else ve(this.lineV,this.labelV);r.x<=0&&r.y<=0&&o.containment!=="none"&&this.label(this.labelH,"inside",(n.left+n.right)/2,n.top-10)}hideGap(){ve(this.lineH,this.lineV,this.labelH,this.labelV)}hideAll(){this.hideBox(),this.hideGap(),ve(this.anchorBox),this.anchored=null}textRow(e){return s("div",{class:"measure-readout__row"},s("span",{text:e}))}sideRow(e,n,o){let r=(i,a,l)=>s("span",{class:`measure-readout__side${l?" measure-readout__side--drawn":""}`,text:`${i} ${a}`});return s("div",{class:"measure-readout__row"},s("span",{class:`measure-readout__dot measure-readout__dot--${e}`}),s("span",{class:"measure-readout__key",text:e}),r("T",n.top,o.top),r("R",n.right,o.right),r("B",n.bottom,o.bottom),r("L",n.left,o.left))}label(e,n,o,r){e.style.display="block",e.textContent=n,e.style.left=`${o}px`,e.style.top=`${r}px`}};function ri(t){let e=a=>a===0?"0":`${a}px`,{top:n,right:o,bottom:r,left:i}=t;return n===o&&o===r&&r===i?e(n):n===r&&i===o?`${e(n)} ${e(o)}`:`${e(n)} ${e(o)} ${e(r)} ${e(i)}`}var So=6,it=8,I=null,Kt=null,Wt=null,Gt=!1,ii=0;function _o(t){Kt=t,I=null,m(document,"scroll",()=>at(),{capture:!0,passive:!0})}function Ao(){return Kt?(I?.isConnected||(I=s("div",{class:"tooltip",attrs:{role:"tooltip","aria-hidden":"true"},style:{display:"none"}}),Kt.append(I)),I):null}function at(){I&&(Gt=!1,I.style.display="none",I.setAttribute("aria-hidden","true"),Wt?.removeAttribute("aria-describedby"),Wt=null)}function ai(t){let e=Ao();if(!e)return;let n=t.getBoundingClientRect(),o=e.getBoundingClientRect(),r=t.closest(".toolbar-dock"),i=r?r.getBoundingClientRect():n,a=i.top-o.height-So;a<it&&(a=i.bottom+So);let l=Math.min(Math.max(it,n.left+n.width/2-o.width/2),Math.max(it,window.innerWidth-o.width-it));e.style.top=`${Math.round(a)}px`,e.style.left=`${Math.round(l)}px`}function Co(t,e,n=!1){let o=Ao();if(!o)return;Gt=n,o.textContent=e,o.style.display="block",o.setAttribute("aria-hidden","false"),o.style.animation="none",o.offsetWidth,o.style.removeProperty("animation");let r=o.id||`sa-tip-${++ii}`;o.id=r,t.setAttribute("aria-describedby",r),Wt=t,ai(t)}function st(t,e){let n=()=>typeof e=="function"?e():e;m(t,"pointerenter",()=>Co(t,n())),m(t,"pointerleave",()=>at()),m(t,"focus",()=>Co(t,n(),!0)),m(t,"blur",()=>at())}function $o(){return Gt&&!!I&&I.isConnected&&I.style.display!=="none"}function lt(){at()}var ct=8,we=12,si=380,li=160,dt=class{constructor(e,n,o){this.callbacks=n;this.selects=new Map;this.switches=new Map;this.swatches=new Map;this.accentCustom=s("input",{class:"accent-custom",attrs:{type:"color","aria-label":"Pick any accent colour"},on:{input:()=>this.emit({accentColor:this.accentCustom.value})}}),this.boxModelRow=this.toggle("showBoxModel","Box model on hover","Shades padding and margin on whatever the pointer is over, and puts the border-box size on a badge. Mode 4 shows them regardless of this."),this.element=s("div",{class:"card settings"},s("div",{class:"card__header"},b("gear",14),s("span",{class:"card__title",text:"Settings"}),s("button",{class:"icon-button",title:"Close",on:{click:()=>n.onClose()}},b("close",14))),s("div",{class:"card__body settings__body"},this.group("Report"),this.select("detailLevel","Detail level","How much each annotation carries into the Markdown report. Forensic includes classes, box and props; compact is one line per note.",Fe.map(({value:r,label:i})=>({value:r,label:i}))),this.select("componentMode","Components","Which framework components get named. Changing the detail level moves this to a matching preset, and you can override it afterwards.",an),this.toggle("includeProps","Include component props","Adds the first few props of the component that owns the element. Values are recorded; a prop holding a secret would end up in the report."),this.select("screenshotDelivery","Screenshots","A link to the file in your Downloads keeps the report small. Embedding survives being pasted somewhere the file cannot follow, at a few hundred kilobytes of base64.",sn),this.group("Bug reports"),this.toggle("captureDiagnostics","Capture errors & steps","Attaches console errors, failed requests and what you clicked. Field values are never recorded and request bodies never leave the page."),this.group("Behaviour"),this.toggle("showMarkers","Show numbered pins","Draws a numbered pin over every annotated element. Turn it off when the pins are covering what you are trying to look at."),this.toggle("freezeOnInspect","Freeze animations on inspect","Parks animations and timers as soon as inspect mode goes on, so a menu or a carousel holds still long enough to annotate."),this.toggle("clearOnCopy","Clear after copying","Empties the page's annotations once a copy has reached the clipboard, ready for the next round. Off by default \u2014 a failed copy never clears."),this.hideUntilRestartRow(),this.group("Measuring"),this.toggle("measureTools","Measuring tools","Adds mode 4: click two elements and the report carries the gap between them in pixels. Off by default \u2014 it puts a fourth button on the toolbar and a fourth clause on the hint line."),this.boxModelRow,this.group("Appearance"),this.select("theme","Theme","The overlay's own colours. Match system follows your browser.",ln),this.accentRow()),s("div",{class:"card__footer settings__footer"},s("span",{class:"settings__version",text:`SenAnnotate ${o}`})));for(let r of e.querySelectorAll('.settings[data-leaving="true"]'))r.remove();e.append(this.element)}group(e){return s("h3",{class:"settings__group",text:e})}row(e,n,o){return s("div",{class:"setting-row"},this.labelFor(e,n),o)}labelFor(e,n){let o=s("button",{class:"hint-dot",text:"?",attrs:{type:"button","aria-label":`What does "${e}" do?`}});return st(o,n),s("span",{class:"setting-row__label"},s("span",{text:e}),o)}select(e,n,o,r){let i=s("select",{class:"select setting-row__control",attrs:{"data-setting":String(e)},on:{change:()=>this.emit({[e]:i.value})}});for(let a of r)i.append(s("option",{text:a.label,attrs:{value:a.value}}));return this.selects.set(e,i),this.row(n,o,i)}toggle(e,n,o){let r=s("input",{attrs:{type:"checkbox","data-setting":String(e)},on:{change:()=>this.emit({[e]:r.checked})}});return this.switches.set(e,r),this.row(n,o,s("label",{class:"switch"},r,s("span",{class:"switch__track"})))}hideUntilRestartRow(){let e=s("input",{attrs:{type:"checkbox","data-action":"hide-until-restart"},on:{change:()=>this.callbacks.onHideUntilRestart()}});return this.row("Hide until restart","Hides the toolbar and everything else in this tab. It stays hidden here \u2014 reloads included \u2014 until the tab is closed; other tabs are untouched.",s("label",{class:"switch"},e,s("span",{class:"switch__track"})))}accentRow(){let e=s("div",{class:"swatches"});for(let{value:n,label:o}of on){let r=s("button",{class:"swatch",title:o,style:{background:n},attrs:{type:"button","aria-label":o,"aria-pressed":"false"},on:{click:()=>this.emit({accentColor:n})}});this.swatches.set(n,r),e.append(r)}return s("div",{class:"setting-row"},this.labelFor("Accent colour","Colours the overlay, the pins and the markup pen. The two shades either side of it are derived, so one colour is all you pick."),s("div",{class:"accent-controls"},e,this.accentCustom,s("button",{class:"link-button",text:"Reset",attrs:{type:"button"},on:{click:()=>this.emit({accentColor:q})}})))}emit(e){this.callbacks.onChange(e)}render(e){for(let[n,o]of this.selects)o.value=String(e[n]);for(let[n,o]of this.switches)o.checked=!!e[n];this.boxModelRow.style.display=e.measureTools?"":"none",this.accentCustom.value=e.accentColor;for(let[n,o]of this.swatches)o.setAttribute("aria-pressed",String(n===e.accentColor))}anchorTo(e){if(!e){delete this.element.dataset.anchored,this.element.style.removeProperty("left"),this.element.style.removeProperty("top"),this.element.style.removeProperty("max-height");return}this.element.dataset.anchored="true";let n=e.top-ct-we,o=window.innerHeight-e.bottom-ct-we,r=n>=o;this.element.style.maxHeight=`${Math.max(li,r?n:o)}px`;let i=this.element.offsetWidth||si,a=this.element.offsetHeight,l=Math.max(we,Math.min(e.right-i,window.innerWidth-i-we)),c=Math.max(we,Math.min(r?e.top-ct-a:e.bottom+ct,window.innerHeight-a-we));this.element.style.left=`${l}px`,this.element.style.top=`${c}px`}destroy(){lt(),Ue(this.element)}};var ci=[{tool:"box",iconName:"marquee",label:"Box",title:"Draw a box"},{tool:"arrow",iconName:"cursor",label:"Arrow",title:"Draw an arrow"},{tool:"blur",iconName:"snowflake",label:"Blur",title:"Pixelate a region \u2014 destroys the pixels"}],Lo="rgba(255,255,255,0.9)",Ae=3,Do=12,di=560,ui=420,ut=class{constructor(e,n,o,r=q){this.scratch=document.createElement("canvas");this.teardown=[];this.toolButtons=new Map;this.shapes=[];this.tool="box";this.drawing=null;this.base=n,this.accent=Oe(r).accent,this.canvas=s("canvas",{class:"shot-editor__canvas"}),this.canvas.width=n.width,this.canvas.height=n.height;let i=this.canvas.getContext("2d");if(!i)throw new Error("senannotate: no 2d context for the markup editor");this.context=i,this.applyDisplaySize();for(let{tool:a,iconName:l,label:c,title:d}of ci){let u=s("button",{class:"shot-tool",title:d,attrs:{"aria-pressed":String(a===this.tool)},on:{click:()=>this.selectTool(a)}},b(l,13),s("span",{text:c}));this.toolButtons.set(a,u)}this.undoButton=s("button",{class:"shot-tool",title:"Undo the last shape",on:{click:()=>this.undo()}},s("span",{text:"Undo"})),this.undoButton.disabled=!0,this.element=s("div",{class:"card shot-editor",attrs:{tabindex:"-1"}},s("div",{class:"card__header"},b("camera",14),s("span",{class:"card__title",text:"Markup"}),s("button",{class:"icon-button",title:"Discard this screenshot (Esc)",on:{click:()=>o.onCancel()}},b("close",14))),s("div",{class:"card__body"},s("div",{class:"shot-editor__tools"},...this.toolButtons.values(),this.undoButton),s("div",{class:"shot-editor__stage"},this.canvas)),s("div",{class:"card__footer"},s("span",{class:"hint",text:"Blur is permanent"}),s("span",{class:"spacer"}),s("button",{class:"button button--ghost",on:{click:()=>o.onCancel()}},s("span",{text:"Cancel"})),s("button",{class:"button button--primary",on:{click:()=>o.onSave(this.flatten())}},s("span",{text:"Save"})))),e.append(this.element),K(this.element),this.repaint(),this.installPointer(),this.teardown.push(m(this.element,"keydown",a=>{let l=a;l.key==="Escape"&&(l.preventDefault(),l.stopPropagation(),o.onCancel()),l.key.toLowerCase()==="z"&&(l.metaKey||l.ctrlKey)&&(l.preventDefault(),this.undo())}));for(let a of["keydown","keyup","keypress"])this.teardown.push(m(this.element,a,l=>l.stopPropagation()))}applyDisplaySize(){let e=Math.min(di,window.innerWidth-80),n=Math.min(ui,window.innerHeight-220),o=Math.min(1,e/this.canvas.width,n/this.canvas.height);this.canvas.style.width=`${Math.max(1,Math.round(this.canvas.width*o))}px`,this.canvas.style.height=`${Math.max(1,Math.round(this.canvas.height*o))}px`}selectTool(e){this.tool=e;for(let[n,o]of this.toolButtons)o.setAttribute("aria-pressed",String(n===e))}undo(){this.shapes.length&&(this.shapes.pop(),this.undoButton.disabled=this.shapes.length===0,this.repaint())}installPointer(){this.teardown.push(m(this.canvas,"pointerdown",n=>{let o=n;o.preventDefault(),this.canvas.setPointerCapture(o.pointerId);let r=this.toCanvas(o);this.drawing={tool:this.tool,from:r,to:r}})),this.teardown.push(m(this.canvas,"pointermove",n=>{this.drawing&&(this.drawing.to=this.toCanvas(n),this.repaint())}));let e=n=>{if(!this.drawing)return;this.drawing.to=this.toCanvas(n),(Math.abs(this.drawing.to.x-this.drawing.from.x)>4||Math.abs(this.drawing.to.y-this.drawing.from.y)>4)&&(this.shapes.push(this.drawing),this.undoButton.disabled=!1),this.drawing=null,this.repaint()};this.teardown.push(m(this.canvas,"pointerup",e)),this.teardown.push(m(this.canvas,"pointercancel",e))}toCanvas(e){let n=this.canvas.getBoundingClientRect(),o=this.canvas.width/(n.width||1),r=this.canvas.height/(n.height||1);return{x:(e.clientX-n.left)*o,y:(e.clientY-n.top)*r}}repaint(){let{context:e}=this;e.clearRect(0,0,this.canvas.width,this.canvas.height),e.drawImage(this.base,0,0);for(let n of this.shapes)this.paint(n);this.drawing&&this.paint(this.drawing)}paint(e){switch(e.tool){case"blur":this.paintBlur(e);break;case"arrow":this.paintArrow(e);break;default:this.paintBox(e)}}normalise({from:e,to:n}){return{x:Math.min(e.x,n.x),y:Math.min(e.y,n.y),w:Math.abs(n.x-e.x),h:Math.abs(n.y-e.y)}}paintBox(e){let{x:n,y:o,w:r,h:i}=this.normalise(e),{context:a}=this;a.lineJoin="round",a.strokeStyle=Lo,a.lineWidth=Ae+3,a.strokeRect(n,o,r,i),a.strokeStyle=this.accent,a.lineWidth=Ae,a.strokeRect(n,o,r,i)}paintArrow(e){let{from:n,to:o}=e,{context:r}=this,i=Math.atan2(o.y-n.y,o.x-n.x),a=Math.max(12,Ae*5),l=(c,d)=>{r.strokeStyle=c,r.fillStyle=c,r.lineWidth=d,r.lineCap="round",r.lineJoin="round",r.beginPath(),r.moveTo(n.x,n.y),r.lineTo(o.x,o.y),r.stroke(),r.beginPath(),r.moveTo(o.x,o.y),r.lineTo(o.x-a*Math.cos(i-Math.PI/7),o.y-a*Math.sin(i-Math.PI/7)),r.lineTo(o.x-a*Math.cos(i+Math.PI/7),o.y-a*Math.sin(i+Math.PI/7)),r.closePath(),r.fill()};l(Lo,Ae+3),l(this.accent,Ae)}paintBlur(e){let{x:n,y:o,w:r,h:i}=this.normalise(e);if(r<2||i<2)return;let a=this.scratch;a.width=Math.max(1,Math.round(r/Do)),a.height=Math.max(1,Math.round(i/Do));let l=a.getContext("2d");if(!l)return;l.clearRect(0,0,a.width,a.height),l.drawImage(this.canvas,n,o,r,i,0,0,a.width,a.height);let{context:c}=this;c.save(),c.imageSmoothingEnabled=!1,c.drawImage(a,0,0,a.width,a.height,n,o,r,i),c.restore()}flatten(){return this.repaint(),this.canvas}destroy(){for(let e of this.teardown)e();this.element.remove()}};var hi=4,ht=8,pi=40,mi=[{mode:"point",iconName:"cursor",title:"Click an element (1)"},{mode:"text",iconName:"text",title:"Select text (2)"},{mode:"area",iconName:"marquee",title:"Drag across elements (3)"},{mode:"measure",iconName:"arrows",title:"Measure distances (4)"}],Ho={point:"Click an element \xB7 \u2318/Ctrl+drag across several \xB7 C captures hover \xB7 2 text \xB7 3 area",text:"Select text \xB7 1 point \xB7 3 area",area:"Drag across elements \xB7 1 point \xB7 2 text",measure:"Click two elements \xB7 C captures the pair \xB7 Esc clears \xB7 1 point \xB7 2 text \xB7 3 area"},gi=" \xB7 4 measure";function fi(t,e){let n=Ho[t];return e&&t!=="measure"?n+gi:n}var pt=class{constructor(e,n){this.callbacks=n;this.modeButtons=new Map;this.hintOverride=null;this.dragSize=null;this.requested=null;this.hintVisible=!1;this.modeHint=Ho.point;this.brandLabel=s("span",{class:"tool__label",text:"Inspect"}),this.brandButton=s("button",{class:"tool tool--brand",attrs:{"aria-label":"Toggle inspect mode (Alt+Shift+S)","aria-pressed":"false"},on:{click:()=>n.onToggleActive()}},b("s",17),this.brandLabel);for(let{mode:a,iconName:l,title:c}of mi){let d=s("button",{class:"tool",attrs:{"aria-label":c,"aria-pressed":"false"},on:{click:()=>n.onModeChange(a)}});d.append(b(l)),this.modeButtons.set(a,d)}this.modeGroup=s("div",{class:"tool-group",style:{display:"none",alignItems:"center",gap:"2px"}},s("span",{class:"divider"}),...this.modeButtons.values()),this.freezeButton=s("button",{class:"tool",attrs:{"aria-label":"Freeze animations (F)","aria-pressed":"false"},on:{click:()=>n.onToggleFreeze()}},b("snowflake")),this.countBadge=s("span",{class:"count",text:"0",style:{display:"none"}}),this.panelButton=s("button",{class:"tool",attrs:{"aria-label":"Annotations (A)","aria-pressed":"false"},on:{click:()=>n.onTogglePanel()}},b("list"),this.countBadge),this.settingsButton=s("button",{class:"tool tool--settings",attrs:{"aria-label":"Settings","aria-pressed":"false"},on:{click:()=>n.onToggleSettings()}},b("gear")),this.stackBadge=s("span",{class:"stack-badge",style:{display:"none"}});let o=b("chevron");o.classList.add("tool__icon--collapse");let r=b("s",17);r.classList.add("tool__icon--expand"),this.handleCount=s("span",{class:"handle-count",text:"0",style:{display:"none"}}),this.collapseButton=s("button",{class:"tool tool--collapse",attrs:{"aria-label":"Collapse toolbar (H)","aria-expanded":"true"},on:{click:()=>n.onToggleCollapse()}},o,r,this.handleCount),this.hintElement=s("div",{class:"toolbar-hint",style:{display:"none"}});let i=s("div",{class:"toolbar"},this.stackBadge,this.brandButton,this.modeGroup,s("span",{class:"divider"}),this.freezeButton,this.panelButton,this.settingsButton,this.collapseButton);this.element=s("div",{class:"toolbar-dock"},this.hintElement,i);for(let a of[this.brandButton,...this.modeButtons.values(),this.freezeButton,this.panelButton,this.settingsButton,this.collapseButton])st(a,()=>a.getAttribute("aria-label")??"");e.append(this.element),this.installDrag(i,n),this.resizeObserver=new ResizeObserver(()=>this.paintPosition()),this.resizeObserver.observe(this.element)}installDrag(e,n){let o=null,r={dx:0,dy:0},i=!1,a=()=>{o=null,this.dragSize=null};e.addEventListener("pointerdown",c=>{if(c.button!==0)return;let d=this.element.getBoundingClientRect();o={x:c.clientX,y:c.clientY},r={dx:c.clientX-d.left,dy:c.clientY-d.top},this.dragSize={width:d.width,height:d.height},i=!1}),e.addEventListener("pointermove",c=>{if(o){if(c.buttons===0){a();return}if(!i){if(Math.abs(c.clientX-o.x)+Math.abs(c.clientY-o.y)<hi)return;i=!0,this.element.dataset.dragging="true";try{e.setPointerCapture(c.pointerId)}catch{}}this.moveTo(c.clientX-r.dx,c.clientY-r.dy)}});let l=c=>{if(!o||c.type==="pointerup"&&c.button!==0)return;let d=i;a(),d&&(delete this.element.dataset.dragging,e.hasPointerCapture(c.pointerId)&&e.releasePointerCapture(c.pointerId),this.requested&&n.onMove(this.requested),window.setTimeout(()=>{i=!1},0))};e.addEventListener("pointerup",l),e.addEventListener("pointercancel",l),e.addEventListener("click",c=>{i&&(i=!1,c.preventDefault(),c.stopPropagation())},{capture:!0})}moveTo(e,n){this.requested={x:e,y:n},this.paintPosition()}paintPosition(){if(!this.requested)return;let e=this.dragSize??this.element.getBoundingClientRect(),n=Math.max(ht,Math.min(this.requested.x,window.innerWidth-e.width-ht)),o=Math.max(ht,Math.min(this.requested.y,window.innerHeight-e.height-ht));this.element.dataset.floating="true",this.element.style.left=`${n}px`,this.element.style.top=`${o}px`,this.element.dataset.hintBelow=String(!this.hintVisible&&o<pi),this.callbacks.onDockShift?.()}dockBox(){return this.element.dataset.floating!=="true"?null:this.element.getBoundingClientRect()}applyPosition(e){if(this.requested=e,!e){delete this.element.dataset.floating,delete this.element.dataset.hintBelow,this.element.style.removeProperty("left"),this.element.style.removeProperty("top"),this.callbacks.onDockShift?.();return}this.paintPosition()}isDragging(){return this.element.dataset.dragging==="true"}update(e){this.applyCollapse(e),this.brandButton.setAttribute("aria-pressed",String(e.active)),this.brandLabel.textContent=e.active?"Inspecting":"Inspect",this.modeGroup.style.display=e.active?"flex":"none";let n=this.modeButtons.get("measure");n&&(n.style.display=e.measureTools?"":"none"),this.modeHint=fi(e.mode,e.measureTools),this.hintVisible=e.active,this.hintElement.style.display=e.active?"block":"none",this.hintOverride===null&&(this.hintElement.textContent=this.modeHint);for(let[o,r]of this.modeButtons)r.setAttribute("aria-pressed",String(e.active&&e.mode===o));this.freezeButton.setAttribute("aria-pressed",String(e.frozen)),this.panelButton.setAttribute("aria-pressed",String(e.panelOpen)),this.settingsButton.setAttribute("aria-pressed",String(e.settingsOpen)),this.countBadge.textContent=String(e.count),this.countBadge.style.display=e.count>0?"inline-flex":"none",this.applyStackBadge(e.page)}applyCollapse({collapsed:e,active:n,count:o}){if(this.element.dataset.collapsed=String(e),this.element.dataset.inspecting=String(n),this.collapseButton.setAttribute("aria-expanded",String(!e)),this.handleCount.textContent=String(o),this.handleCount.style.display=e&&o>0?"inline-flex":"none",!e){this.collapseButton.setAttribute("aria-label","Collapse toolbar (H)");return}this.collapseButton.setAttribute("aria-label",o?`Show toolbar (H) \u2014 ${o} annotation${o===1?"":"s"}`:"Show toolbar (H)")}applyStackBadge(e){if(!e){this.stackBadge.style.display="none";return}if(!e.detected){this.stackBadge.style.display="none",delete this.stackBadge.dataset.warn;return}let n=e.flavour??e.framework??"Detected";this.stackBadge.style.display="inline-flex",this.stackBadge.textContent=e.version?`${n} ${e.version}`:n,e.devMetadata?(delete this.stackBadge.dataset.warn,this.stackBadge.title=e.hasSourcePositions?"Dev build with source positions \u2014 source lines include line and column numbers.":"Dev build \u2014 source lines will be file-level only. A source-position plugin (Nuxt DevTools, for instance) adds line and column numbers."):(this.stackBadge.dataset.warn="true",this.stackBadge.title="Production build \u2014 component names and file paths are stripped. Reports will fall back to selectors and DOM paths.")}setHint(e){this.hintOverride=e,this.hintElement.textContent=e??this.modeHint}destroy(){this.resizeObserver.disconnect(),this.element.remove()}};if(window.__senannotateInstalled)throw new Error("senannotate: already installed");window.__senannotateInstalled=!0;var p={...ue},M=[],He=null,ke=null,k=!1,w="point",re=!1,ie=!1,y=null,A=null,bt=null,Le=null,W=null,X=null,mt=!1,Q=null,Jt=[],ee={elements:[],rects:[],capped:!1},j=0,S=[],yt=null,z=[],xe=null,vt=null,Vt=0,Ee=!1,g,v,en,B,Z=null,N=null,x;function bi(){g=je(),_o(g.cardLayer),v=new ye(g.overlayLayer),x=new rt(g.overlayLayer),en=new Je(g.markerLayer,{onClick:t=>qo(t),onHoverChange:t=>{if(!A){if(!t){v.hideHighlights();return}v.showHighlights(be(t),{primary:t.element,secondary:P(t.source)})}}}),B=new pt(g.cardLayer,{onToggleActive:()=>xt(!k),onModeChange:t=>{w=t,ae(),J(),v.hideAll(),x.hideAll(),E(),Ye(k,w)},onToggleFreeze:()=>tn(),onTogglePanel:()=>Me(),onToggleSettings:()=>Pe(),onToggleCollapse:()=>Fo(),onMove:t=>{yt=t,fo(t)},onDockShift:()=>N?.anchorTo(B.dockBox())})}var yi={onClose:()=>Pe(!1),onHideUntilRestart:()=>xi(),onChange:t=>{let e=t.detailLevel!==void 0?{componentMode:Tt[t.detailLevel]}:{};p={...p,...e,...t},Qe(p),wt(),Oo(),E()}},vi={onClose:()=>Me(!1),onCopy:()=>$i(),onDownload:()=>Li(),onClearAll:()=>Pi(),onSelect:t=>{Ai(t),qo(t)},onToggleStatus:t=>{t.status=F(t)?"open":"done",Be(),E()},onHoverChange:t=>{if(!t){v.hideHighlights();return}v.showHighlights(be(t),{primary:t.element,secondary:P(t.source)})},onDetailChange:t=>{p={...p,detailLevel:t,componentMode:Tt[t]},Qe(p),E()}};function Oo(){p.measureTools||w!=="measure"||(w="point",x.hideAll(),Ye(k,w))}function E(){B.update({active:k,mode:w,frozen:re,panelOpen:ie,settingsOpen:!!N,measureTools:p.measureTools,collapsed:p.toolbarCollapsed,count:M.length,page:He}),en.render(M,p.showMarkers&&!!M.length),Z?.render(M,p.detailLevel),N?.render(p),Ri()}function wt(){g.setTheme(p.theme),g.setAccent(p.accentColor)}function xt(t){k!==t&&(k=t,Pn(k),k&&!He?.detected&&Yo(),k?(document.body.style.setProperty("cursor","crosshair","important"),p.freezeOnInspect&&!re&&tn(!0)):(ae(),J(),v.hideAll(),y=null,le=null,document.body.style.removeProperty("cursor")),Ye(k,w),E())}async function tn(t){let e=t??!re;e!==re&&(re=e,await qn(re),g.toast(re?"Animations frozen":"Animations resumed"),E())}function wi(){try{return window.sessionStorage.getItem(Lt)==="1"}catch{return!1}}function xi(){try{window.sessionStorage.setItem(Lt,"1")}catch{}g.host.style.setProperty("display","none","important")}function Pe(t){let e=t??!N;e!==!!N&&(e?(Me(!1),N=new dt(g.cardLayer,yi,chrome.runtime.getManifest().version),N.render(p),N.anchorTo(B.dockBox())):(N?.destroy(),N=null),E())}function Me(t){ie=t??!ie,ie&&Pe(!1),ie&&!Z&&(Z=new ot(g.cardLayer,vi),No()),!ie&&Z&&(Z.destroy(),Z=null,v.hideHighlights()),E()}function Fo(t){let e=t??!p.toolbarCollapsed;e!==p.toolbarCollapsed&&(p={...p,toolbarCollapsed:e},Qe(p),e&&(xt(!1),Me(!1),Pe(!1)),E())}function No(){!Z||!p.captureDiagnostics||Z.renderCaptureSummary({logs:ke?.logs.length??0,requests:ke?.network.length??0,actions:Rt().length})}var Bo=0,le=null;async function gt(t){y=t;let e=++Bo,{name:n}=R(t);if(le={primary:n},Qt(t),p.componentMode==="off")return;let o=await We(t,p.componentMode,p.maxComponents,!1);e!==Bo||y!==t||(le={primary:o?.ownerComponent?`<${o.ownerComponent}>`:n,secondary:P(Ge(t,o))},Qt(t))}function Qt(t){if(S.length){kt();return}v.showHighlights([t.getBoundingClientRect()],le??void 0),ki(t)}function ki(t){if(!p.measureTools||w!=="measure"&&!p.showBoxModel){x.hideBox(),x.hideGap();return}let e=getComputedStyle(t),n=t.getBoundingClientRect();x.showBox(n,nt(t,e),Mo(t,e));let o=x.anchor;if(!o||o===t){x.hideGap();return}let r=o.getBoundingClientRect();x.showGap(r,n,Ut(r,n))}function zo(t){let e=x.anchor;if(!e||e===t)return{box:nt(t)};let n=e.getBoundingClientRect(),o=t.getBoundingClientRect();return{box:nt(e),gap:{...Ut(n,o),toElement:R(t).name,toSelector:me(t)}}}function Ei(){if(!(w!=="point"&&w!=="measure")){if(y&&!y.isConnected&&(y=null),!y){g.toast("Hover an element first","error");return}if(!no(y)){if(w==="measure"){let t=x.anchor,e=zo(y),n=t&&t!==y?[t,y]:[y];x.setAnchor(null),se(n,void 0,e);return}se([y])}}}function Mi(t){let e=t.boundingBox;return e?new DOMRect(e.x-window.scrollX,e.y-window.scrollY,e.width,e.height):new DOMRect(window.innerWidth/2,window.innerHeight/2,0,0)}async function se(t,e,n){let o=await Ce(t,{settings:p,selectedText:e,measurements:n});o&&(z=t,nn(o,t[0].getBoundingClientRect(),null))}function qo(t){let e=It(t);z=e?[e]:[];let o=be(t)[0]??new DOMRect(window.innerWidth/2,window.innerHeight/2,0,0);nn(t,o,t)}function Uo(t){let e=t.framework?.props?Object.entries(t.framework.props).slice(0,4).map(([n,o])=>`${n}=${o}`).join(", "):"";return{title:t.element,source:P(t.source),components:t.framework?.path??null,props:e||null,selectedText:t.selectedText,elementCount:t.elementBoundingBoxes?.length}}function nn(t,e,n){A?.destroy(),bt=n,v.showHighlights(n?be(n):z.map(r=>r.getBoundingClientRect()),{primary:t.element,secondary:P(t.source)}),xe=t,vt=z[0]??null;let o={onSubmit:(r,i)=>{n?(n.comment=r,n.kind=i):M=[...M,{...xe??t,id:_i(),comment:r,kind:i,timestamp:Date.now()}],De(),Be(),E(),g.toast(n?"Annotation updated":"Annotation added")},onCancel:()=>De(),onScreenshot:()=>void Di(n??xe??t),onDelete:n?()=>{M=M.filter(r=>r.id!==n.id),De(),Be(),E(),g.toast("Annotation deleted")}:void 0,onRetarget:Ci(t,n)?r=>void Si(r):void 0};A=new Ze(g.cardLayer,e,{...Uo(t),initialComment:n?.comment,initialKind:n?.kind},o)}function jt(t){if(!$e(t))return!1;let e=t.getBoundingClientRect();return e.width>0&&e.height>0}function Ti(t,e){if(e==="parent"){for(let o=t.parentElement;o;o=o.parentElement)if(jt(o))return o;return null}if(e==="child"){for(let o=t.firstElementChild;o;o=o.nextElementSibling)if(jt(o))return o;return null}let n=e==="next";for(let o=n?t.nextElementSibling:t.previousElementSibling;o;o=n?o.nextElementSibling:o.previousElementSibling)if(jt(o))return o;return null}async function Si(t){let e=A;if(!e||!k)return;if(xe?.screenshot||Le||Ee){g.toast("Retake the screenshot after choosing the element","error");return}let n=vt??z[0];if(!n)return;if(!n.isConnected){g.toast("That element is gone from the page","error");return}let o=Ti(n,t);if(!o){g.toast("Nothing there","error");return}vt=o;let r=++Vt;v.showHighlights([o.getBoundingClientRect()],{primary:R(o).name});let i=await Ce([o],{settings:p});!i||r!==Vt||A!==e||(z=[o],xe=i,A.setData(Uo(i)),v.showHighlights([o.getBoundingClientRect()],{primary:i.element,secondary:P(i.source)}))}function Ci(t,e){if(e||t.selectedText||t.isMultiSelect||(t.elementBoundingBoxes?.length??1)>1)return!1;let n=z[0];return z.length===1&&!!n&&n.ownerDocument===document}function De(){ft(),A?.destroy(),A=null,bt=null,z=[],xe=null,vt=null,Ee=!1,Vt+=1,v.hideHighlights()}function _i(){return`a${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`}async function Be(){let t=await po(M);t.droppedImages&&g.toast(`Stored without ${t.droppedImages} embedded image${t.droppedImages===1?"":"s"} \u2014 too large to keep`,"error")}function Ai(t){let e=It(t);if(e){e.scrollIntoView({behavior:"smooth",block:"center"});return}t.isFixed||window.scrollTo({top:Math.max(0,t.y-window.innerHeight/2),behavior:"smooth"})}function Ko(){return un(M,{pathname:location.pathname,href:location.href,page:He,diagnostics:p.captureDiagnostics?ke:null,actions:p.captureDiagnostics?Rt():[]},p.detailLevel)}function $i(){if(!M.length)return;let t=M,e=new Set(t.map(r=>r.id)),n=t.length,o=Ko();jn(o,g.shadow).then(r=>{if(!r){g.toast("Copy failed","error");return}let i=`${n} annotation${n===1?"":"s"}`;if(p.clearOnCopy){Wo(e),g.toast(`Copied ${i} \xB7 cleared`,"success");return}g.toast(`Copied ${i}`,"success")})}function Li(){if(!M.length)return;let t=`${location.hostname}${location.pathname}`.replace(/[^a-z0-9]+/gi,"-").replace(/^-+|-+$/g,"").slice(0,60),e=new Blob([Ko()],{type:"text/markdown"}),n=Ft(e,`senannotate-${t||"report"}.md`);g.toast(n?"Report saved to Downloads":"Could not save the report",n?"success":"error")}async function Di(t){Ee=!0;let e=!1;try{let n=z[0],o=n?n.getBoundingClientRect():be(t)[0];if(!o||o.width===0||o.height===0){g.toast("Nothing to capture","error");return}g.host.style.setProperty("display","none","important"),await new Promise(a=>requestAnimationFrame(()=>requestAnimationFrame(a)));let r=null;try{r=await Go({kind:"capture"})}finally{g.host.style.removeProperty("display")}if(!r?.ok||!r.dataUrl){g.toast("Screenshot failed","error");return}let i=await io(r.dataUrl,o);if(!i){g.toast("Screenshot failed","error");return}Hi(i,t),e=!0}finally{e||(Ee=!1)}}function Hi(t,e){ft(),Le=new ut(g.cardLayer,t,{onCancel:()=>{ft(),Ee=!1},onSave:n=>{ft(),Bi(n,e)}},p.accentColor)}function ft(){Le&&(Le.destroy(),Le=null,A?.focus())}async function Bi(t,e){try{let n=await ao(t);if(!n){g.toast("Could not save screenshot","error");return}let o=`senannotate-${Date.now()}.png`;if(!Ft(n,o)){g.toast("Could not save screenshot","error");return}e.screenshot=o,e.screenshotPath=lo(o),e.screenshotData=p.screenshotDelivery==="embed"?so(t)??void 0:void 0,g.toast("Screenshot saved to Downloads"),Be()}finally{Ee=!1}}function Wo(t){M=t?M.filter(e=>!t.has(e.id)):[],bt&&!M.some(e=>e.id===bt?.id)&&De(),A||v.hideHighlights(),In(),ke=null,Kn(),Be(),E()}function Pi(){M.length&&(Wo(),g.toast("All annotations cleared"))}async function Go(t){try{return await chrome.runtime.sendMessage(t)}catch{return null}}async function Ri(){await Go({kind:"badge",count:M.length})}function $e(t){return ge(t)&&!_(t)&&!to(t)}function jo(t,e=0){if(t.capped)return`${G} elements (limit) \xB7 release to annotate`;let n=t.elements.length+e;return n===0?"Nothing inside the box yet":`${n} element${n===1?"":"s"} selected \xB7 release to annotate`}function Ii(){return S.length>=G?`${G} elements (limit) \xB7 Enter to annotate`:`${S.length} element${S.length===1?"":"s"} picked \xB7 \u2318/Ctrl+click to add \xB7 Enter to annotate`}function Re(){return S.some(t=>!t.isConnected)&&(S=S.filter(t=>t.isConnected)),S}function kt(){let t=Re();if(!t.length)return;let e=y&&y.isConnected&&!t.includes(y)?y:null,n=e?[e,...t]:t;v.showHighlights(n.map(o=>o.getBoundingClientRect()),e?le??void 0:void 0,{preview:!0}),B.setHint(Ii())}function J(){S=[],v.hideHighlights(),B.setHint(null)}function Oi(t){let e=Re();if(e.includes(t)?S=e.filter(n=>n!==t):e.length<G&&(S=[...e,t]),!S.length){J(),y?.isConnected&&gt(y);return}kt()}function Po(t){let e=Re(),n=t&&!e.includes(t)?[...e,t]:[...e];S=[],B.setHint(null),n.length&&se(n.slice(0,G))}function Xo(t){W=t,Q=t,Jt=xo(),ee={elements:[],rects:[],capped:!1},v.hideHighlights(),B.setHint(jo(ee))}function Fi(t){if(!X)return!1;let e=t.clientX+window.scrollX,n=t.clientY+window.scrollY;if(Math.abs(e-X.x)<_e&&Math.abs(n-X.y)<_e)return!1;let o=X;return X=null,Xo(o),!0}function ae(){j&&(cancelAnimationFrame(j),j=0),W=null,Q=null,Jt=[],ee={elements:[],rects:[],capped:!1},v.hideMarquee(),B.setHint(null)}function Ro(){if(!W||!Q)return;let t={left:Math.min(W.x,Q.x),top:Math.min(W.y,Q.y),right:Math.max(W.x,Q.x),bottom:Math.max(W.y,Q.y)};v.showMarquee(Nt(t)),ee=ko(Jt,t);let e=Re().filter(n=>!ee.elements.includes(n));v.showHighlights([...e.map(n=>n.getBoundingClientRect()),...ee.rects.map(Nt)],void 0,{preview:!0}),B.setHint(jo(ee,e.length))}var Xt=!1,Zt=!1;function Io(){Xt||(Xt=!0,requestAnimationFrame(()=>{if(Xt=!1,Zt&&(Zt=!1,B.applyPosition(yt)),g.syncPlacement(),en.syncPositions(),!(A||!k)){if(w==="measure"){x.syncAnchor(),y?.isConnected&&Qt(y);return}w==="point"&&(S.length?kt():y&&v.showHighlights([y.getBoundingClientRect()],le??void 0))}}))}var Ni=[0,400,1e3,2e3,4e3,8e3],Yt=!1;async function Yo(){if(!(Yt||He?.detected)){Yt=!0;try{for(let t of Ni){t&&await new Promise(n=>window.setTimeout(n,t));let e=await zn();if(e&&(He=e,E(),e.detected))return}}finally{Yt=!1}}}async function zi(){p=await Ve(),wt(),M=await ho(),yt=await go(),bo(t=>{p=t,wt(),E()}),p.captureDiagnostics&&(Rn(),Nn(t=>{ke=t,No()}),ke=await Un()),E(),B.applyPosition(yt),await Yo()}function qi(){if(bi(),wi()){g.host.style.setProperty("display","none","important");return}oo(e=>{k&&(z=[],nn({...e,screenshotData:void 0},Mi(e),null))}),chrome.runtime.onMessage.addListener((e,n,o)=>e.kind==="toggle-inspect"?(xt(!k),o({ok:!0,active:k}),!0):e.kind==="get-status"?(o({ok:!0,count:M.length,active:k}),!0):e.kind==="settings-changed"?(t(),o({ok:!0}),!0):!1);async function t(){p=await Ve(),wt(),Oo(),E()}m(document,"pointermove",e=>{if(!k||A||W||w!=="point"&&w!=="measure"||B.isDragging())return;let n=document.elementFromPoint(e.clientX,e.clientY);if(!n||!$e(n)){y=null,le=null,S.length?kt():v.hideHighlights(),x.hideBox(),x.hideGap();return}n!==y&&gt(n)},{passive:!0}),m(document,"click",e=>{if(mt){mt=!1,e.preventDefault(),e.stopPropagation();return}if(!k||A||_(e.target)||w==="text")return;if(e.preventDefault(),e.stopPropagation(),w==="measure"){let o=document.elementFromPoint(e.clientX,e.clientY);if(!o||!$e(o))return;if(!x.anchor){x.setAnchor(o),E();return}let r=x.anchor,i=zo(o);x.setAnchor(null),se(r===o?[o]:[r,o],void 0,i);return}if(w!=="point")return;let n=document.elementFromPoint(e.clientX,e.clientY);if(!(!n||!$e(n))){if(e.metaKey||e.ctrlKey){Oi(n);return}if(S.length){Po(n);return}se([n])}},{capture:!0});for(let e of["mousedown","mouseup"])m(document,e,n=>{!k||A||w==="text"||_(n.target)||(n.preventDefault(),n.stopPropagation())},{capture:!0});m(document,"mouseup",()=>{!k||A||w!=="text"||window.setTimeout(()=>{let e=window.getSelection(),n=e?.toString().trim();if(!e||!n)return;let o=e.getRangeAt(0).commonAncestorContainer,r=o.nodeType===Node.ELEMENT_NODE?o:o.parentElement;!r||!$e(r)||se([r],n)},0)}),m(document,"pointerdown",e=>{if(mt=!1,X=null,!k||A||_(e.target))return;let n={x:e.clientX+window.scrollX,y:e.clientY+window.scrollY};if(w==="area"){Xo(n);return}w==="point"&&(e.metaKey||e.ctrlKey)&&(X=n)},{capture:!0}),m(document,"pointermove",e=>{X&&!Fi(e)||W&&(Q={x:e.clientX+window.scrollX,y:e.clientY+window.scrollY},!j&&(j=requestAnimationFrame(()=>{j=0,Ro()})))},{passive:!0}),m(document,"pointerup",()=>{if(X=null,!W)return;j&&(cancelAnimationFrame(j),j=0,Ro());let e=ee;ae(),mt=!0;let n=Re(),o=[...n,...e.elements.filter(r=>!n.includes(r))];if(!o.length){v.hideHighlights();return}S=[],se(o.slice(0,G))},{capture:!0}),m(document,"keydown",e=>{let n=e;if(n.key==="Escape"){if(A){De();return}if($o()){lt();return}if(N){Pe(!1);return}if(x.anchor){x.setAnchor(null),y?.isConnected&&gt(y);return}if(S.length){J(),y?.isConnected&&gt(y);return}if(ie){Me(!1);return}if(k){xt(!1);return}}if(A)return;let o=n.target;if(!o?.isContentEditable&&!(o&&/^(input|textarea|select)$/i.test(o.tagName))&&!(n.metaKey||n.ctrlKey||n.altKey)){if(n.key==="h"){Fo();return}if(k)switch(n.key){case"1":w="point",ae(),J(),v.hideAll(),x.hideAll(),E();break;case"2":w="text",ae(),J(),v.hideAll(),x.hideAll(),E();break;case"4":if(!p.measureTools)break;w="measure",ae(),J(),v.hideAll(),x.hideAll(),E();break;case"3":w="area",ae(),J(),v.hideAll(),x.hideAll(),E();break;case"c":case"C":case"Enter":S.length?Po():Ei();break;case"f":tn();break;case"a":Me();break;default:break}}}),m(window,"scroll",Io,{passive:!0,capture:!0}),m(window,"resize",()=>{Zt=!0,Io()},{passive:!0}),zi()}Jn()?qi():eo()&&(ro(()=>p),Ve().then(t=>{p=t}));})();
