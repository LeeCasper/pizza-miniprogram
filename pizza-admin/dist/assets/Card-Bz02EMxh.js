import{d as Z,k as r,b as d,a0 as oo,l as i,e as l,q as eo,s as ro,r as u,u as to,f as P,g as no,h as ao,C as lo,a1 as x,S as io,a2 as so,v as w,a3 as co}from"./_plugin-vue_export-helper-B5iuTD4Z.js";import{d as bo,k as c,i as E}from"./index-CEpvOXI_.js";const go={paddingSmall:"12px 16px 12px",paddingMedium:"19px 24px 20px",paddingLarge:"23px 32px 24px",paddingHuge:"27px 40px 28px",titleFontSizeSmall:"16px",titleFontSizeMedium:"18px",titleFontSizeLarge:"18px",titleFontSizeHuge:"18px",closeIconSize:"18px",closeSize:"22px"};function po(t){const{primaryColor:C,borderRadius:v,lineHeight:e,fontSize:p,cardColor:b,textColor2:f,textColor1:z,dividerColor:s,fontWeightStrong:a,closeIconColor:o,closeIconColorHover:n,closeIconColorPressed:g,closeColorHover:m,closeColorPressed:S,modalColor:y,boxShadow1:$,popoverColor:k,actionColor:h}=t;return Object.assign(Object.assign({},go),{lineHeight:e,color:b,colorModal:y,colorPopover:k,colorTarget:C,colorEmbedded:h,colorEmbeddedModal:h,colorEmbeddedPopover:h,textColor:f,titleTextColor:z,borderColor:s,actionColor:h,titleFontWeight:a,closeColorHover:m,closeColorPressed:S,closeBorderRadius:v,closeIconColor:o,closeIconColorHover:n,closeIconColorPressed:g,fontSizeSmall:p,fontSizeMedium:p,fontSizeLarge:p,fontSizeHuge:p,boxShadow:$,borderRadius:v})}const vo={common:Z,self:po},F=d("card-content",`
 flex: 1;
 min-width: 0;
 box-sizing: border-box;
 padding: 0 var(--n-padding-left) var(--n-padding-bottom) var(--n-padding-left);
 font-size: var(--n-font-size);
`),fo=r([d("card",`
 font-size: var(--n-font-size);
 line-height: var(--n-line-height);
 display: flex;
 flex-direction: column;
 width: 100%;
 box-sizing: border-box;
 position: relative;
 border-radius: var(--n-border-radius);
 background-color: var(--n-color);
 color: var(--n-text-color);
 word-break: break-word;
 transition: 
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 box-shadow .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[oo({background:"var(--n-color-modal)"}),i("hoverable",[r("&:hover","box-shadow: var(--n-box-shadow);")]),i("content-segmented",[r(">",[d("card-content",`
 padding-top: var(--n-padding-bottom);
 `),l("content-scrollbar",[r(">",[d("scrollbar-container",[r(">",[d("card-content",`
 padding-top: var(--n-padding-bottom);
 `)])])])])])]),i("content-soft-segmented",[r(">",[d("card-content",`
 margin: 0 var(--n-padding-left);
 padding: var(--n-padding-bottom) 0;
 `),l("content-scrollbar",[r(">",[d("scrollbar-container",[r(">",[d("card-content",`
 margin: 0 var(--n-padding-left);
 padding: var(--n-padding-bottom) 0;
 `)])])])])])]),i("footer-segmented",[r(">",[l("footer",`
 padding-top: var(--n-padding-bottom);
 `)])]),i("footer-soft-segmented",[r(">",[l("footer",`
 padding: var(--n-padding-bottom) 0;
 margin: 0 var(--n-padding-left);
 `)])]),r(">",[d("card-header",`
 box-sizing: border-box;
 display: flex;
 align-items: center;
 font-size: var(--n-title-font-size);
 padding:
 var(--n-padding-top)
 var(--n-padding-left)
 var(--n-padding-bottom)
 var(--n-padding-left);
 `,[l("main",`
 font-weight: var(--n-title-font-weight);
 transition: color .3s var(--n-bezier);
 flex: 1;
 min-width: 0;
 color: var(--n-title-text-color);
 `),l("extra",`
 display: flex;
 align-items: center;
 font-size: var(--n-font-size);
 font-weight: 400;
 transition: color .3s var(--n-bezier);
 color: var(--n-text-color);
 `),l("close",`
 margin: 0 0 0 8px;
 transition:
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 `)]),l("action",`
 box-sizing: border-box;
 transition:
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 background-clip: padding-box;
 background-color: var(--n-action-color);
 `),F,d("card-content",[r("&:first-child",`
 padding-top: var(--n-padding-bottom);
 `)]),l("content-scrollbar",`
 display: flex;
 flex-direction: column;
 `,[r(">",[d("scrollbar-container",[r(">",[F])])]),r("&:first-child >",[d("scrollbar-container",[r(">",[d("card-content",`
 padding-top: var(--n-padding-bottom);
 `)])])])]),l("footer",`
 box-sizing: border-box;
 padding: 0 var(--n-padding-left) var(--n-padding-bottom) var(--n-padding-left);
 font-size: var(--n-font-size);
 `,[r("&:first-child",`
 padding-top: var(--n-padding-bottom);
 `)]),l("action",`
 background-color: var(--n-action-color);
 padding: var(--n-padding-bottom) var(--n-padding-left);
 border-bottom-left-radius: var(--n-border-radius);
 border-bottom-right-radius: var(--n-border-radius);
 `)]),d("card-cover",`
 overflow: hidden;
 width: 100%;
 border-radius: var(--n-border-radius) var(--n-border-radius) 0 0;
 `,[r("img",`
 display: block;
 width: 100%;
 `)]),i("bordered",`
 border: 1px solid var(--n-border-color);
 `,[r("&:target","border-color: var(--n-color-target);")]),i("action-segmented",[r(">",[l("action",[r("&:not(:first-child)",`
 border-top: 1px solid var(--n-border-color);
 `)])])]),i("content-segmented, content-soft-segmented",[r(">",[d("card-content",`
 transition: border-color 0.3s var(--n-bezier);
 `,[r("&:not(:first-child)",`
 border-top: 1px solid var(--n-border-color);
 `)]),l("content-scrollbar",`
 transition: border-color 0.3s var(--n-bezier);
 `,[r("&:not(:first-child)",`
 border-top: 1px solid var(--n-border-color);
 `)])])]),i("footer-segmented, footer-soft-segmented",[r(">",[l("footer",`
 transition: border-color 0.3s var(--n-bezier);
 `,[r("&:not(:first-child)",`
 border-top: 1px solid var(--n-border-color);
 `)])])]),i("embedded",`
 background-color: var(--n-color-embedded);
 `)]),eo(d("card",`
 background: var(--n-color-modal);
 `,[i("embedded",`
 background-color: var(--n-color-embedded-modal);
 `)])),ro(d("card",`
 background: var(--n-color-popover);
 `,[i("embedded",`
 background-color: var(--n-color-embedded-popover);
 `)]))]),mo={title:[String,Function],contentClass:String,contentStyle:[Object,String],contentScrollable:Boolean,headerClass:String,headerStyle:[Object,String],headerExtraClass:String,headerExtraStyle:[Object,String],footerClass:String,footerStyle:[Object,String],embedded:Boolean,segmented:{type:[Boolean,Object],default:!1},size:String,bordered:{type:Boolean,default:!0},closable:Boolean,hoverable:Boolean,role:String,onClose:[Function,Array],tag:{type:String,default:"div"},cover:Function,content:[String,Function],footer:Function,action:Function,headerExtra:Function,closeFocusable:Boolean},ho=Object.assign(Object.assign({},P.props),mo),Co=bo({name:"Card",props:ho,slots:Object,setup(t){const C=()=>{const{onClose:n}=t;n&&lo(n)},{inlineThemeDisabled:v,mergedClsPrefixRef:e,mergedRtlRef:p,mergedComponentPropsRef:b}=to(t),f=P("Card","-card",fo,vo,t,e),z=no("Card",p,e),s=E(()=>{var n,g;return t.size||((g=(n=b==null?void 0:b.value)===null||n===void 0?void 0:n.Card)===null||g===void 0?void 0:g.size)||"medium"}),a=E(()=>{const n=s.value,{self:{color:g,colorModal:m,colorTarget:S,textColor:y,titleTextColor:$,titleFontWeight:k,borderColor:h,actionColor:R,borderRadius:B,lineHeight:_,closeIconColor:M,closeIconColorHover:O,closeIconColorPressed:j,closeColorHover:H,closeColorPressed:I,closeBorderRadius:T,closeIconSize:V,closeSize:L,boxShadow:N,colorPopover:W,colorEmbedded:q,colorEmbeddedModal:A,colorEmbeddedPopover:D,[w("padding",n)]:K,[w("fontSize",n)]:G,[w("titleFontSize",n)]:J},common:{cubicBezierEaseInOut:Q}}=f.value,{top:U,left:X,bottom:Y}=co(K);return{"--n-bezier":Q,"--n-border-radius":B,"--n-color":g,"--n-color-modal":m,"--n-color-popover":W,"--n-color-embedded":q,"--n-color-embedded-modal":A,"--n-color-embedded-popover":D,"--n-color-target":S,"--n-text-color":y,"--n-line-height":_,"--n-action-color":R,"--n-title-text-color":$,"--n-title-font-weight":k,"--n-close-icon-color":M,"--n-close-icon-color-hover":O,"--n-close-icon-color-pressed":j,"--n-close-color-hover":H,"--n-close-color-pressed":I,"--n-border-color":h,"--n-box-shadow":N,"--n-padding-top":U,"--n-padding-bottom":Y,"--n-padding-left":X,"--n-font-size":G,"--n-title-font-size":J,"--n-close-size":L,"--n-close-icon-size":V,"--n-close-border-radius":T}}),o=v?ao("card",E(()=>s.value[0]),a,t):void 0;return{rtlEnabled:z,mergedClsPrefix:e,mergedTheme:f,handleCloseClick:C,cssVars:v?void 0:a,themeClass:o==null?void 0:o.themeClass,onRender:o==null?void 0:o.onRender}},render(){const{segmented:t,bordered:C,hoverable:v,mergedClsPrefix:e,rtlEnabled:p,onRender:b,embedded:f,tag:z,$slots:s}=this;return b==null||b(),c(z,{class:[`${e}-card`,this.themeClass,f&&`${e}-card--embedded`,{[`${e}-card--rtl`]:p,[`${e}-card--content-scrollable`]:this.contentScrollable,[`${e}-card--content${typeof t!="boolean"&&t.content==="soft"?"-soft":""}-segmented`]:t===!0||t!==!1&&t.content,[`${e}-card--footer${typeof t!="boolean"&&t.footer==="soft"?"-soft":""}-segmented`]:t===!0||t!==!1&&t.footer,[`${e}-card--action-segmented`]:t===!0||t!==!1&&t.action,[`${e}-card--bordered`]:C,[`${e}-card--hoverable`]:v}],style:this.cssVars,role:this.role},u(s.cover,a=>{const o=this.cover?x([this.cover()]):a;return o&&c("div",{class:`${e}-card-cover`,role:"none"},o)}),u(s.header,a=>{const{title:o}=this,n=o?x(typeof o=="function"?[o()]:[o]):a;return n||this.closable?c("div",{class:[`${e}-card-header`,this.headerClass],style:this.headerStyle,role:"heading"},c("div",{class:`${e}-card-header__main`,role:"heading"},n),u(s["header-extra"],g=>{const m=this.headerExtra?x([this.headerExtra()]):g;return m&&c("div",{class:[`${e}-card-header__extra`,this.headerExtraClass],style:this.headerExtraStyle},m)}),this.closable&&c(so,{clsPrefix:e,class:`${e}-card-header__close`,onClick:this.handleCloseClick,focusable:this.closeFocusable,absolute:!0})):null}),u(s.default,a=>{const{content:o}=this,n=o?x(typeof o=="function"?[o()]:[o]):a;return n?this.contentScrollable?c(io,{class:`${e}-card__content-scrollbar`,contentClass:[`${e}-card-content`,this.contentClass],contentStyle:this.contentStyle},n):c("div",{class:[`${e}-card-content`,this.contentClass],style:this.contentStyle,role:"none"},n):null}),u(s.footer,a=>{const o=this.footer?x([this.footer()]):a;return o&&c("div",{class:[`${e}-card__footer`,this.footerClass],style:this.footerStyle,role:"none"},o)}),u(s.action,a=>{const o=this.action?x([this.action()]):a;return o&&c("div",{class:`${e}-card__action`,role:"none"},o)}))}});export{Co as N};
