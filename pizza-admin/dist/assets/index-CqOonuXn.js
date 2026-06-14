import{i as V,j as f,k as d,d as C,l as r,m as B,n as z,p as I,q as P,s as W,t as A,v as E,x as j,w as t,r as U,o as k,h as q,a,b as s,g as m,y as p}from"./index-C_OtW0i9.js";import{A as D,N as b,F as G,U as L,I as H}from"./AdminLayout-DSLzkhmW.js";import{N as _,a as M}from"./Grid-CIxwOe6H.js";import{r as v,_ as J}from"./_plugin-vue_export-helper-CckW2H24.js";import{N as g}from"./Card-BMPmgrd5.js";function K(o){const{textColor2:e,textColor3:i,fontSize:n,fontWeight:u}=o;return{labelFontSize:n,labelFontWeight:u,valueFontWeight:u,valueFontSize:"24px",labelTextColor:i,valuePrefixTextColor:e,valueSuffixTextColor:e,valueTextColor:e}}const Q={common:V,self:K},X=f("statistic",[d("label",`
 font-weight: var(--n-label-font-weight);
 transition: .3s color var(--n-bezier);
 font-size: var(--n-label-font-size);
 color: var(--n-label-text-color);
 `),f("statistic-value",`
 margin-top: 4px;
 font-weight: var(--n-value-font-weight);
 `,[d("prefix",`
 margin: 0 4px 0 0;
 font-size: var(--n-value-font-size);
 transition: .3s color var(--n-bezier);
 color: var(--n-value-prefix-text-color);
 `,[f("icon",{verticalAlign:"-0.125em"})]),d("content",`
 font-size: var(--n-value-font-size);
 transition: .3s color var(--n-bezier);
 color: var(--n-value-text-color);
 `),d("suffix",`
 margin: 0 0 0 4px;
 font-size: var(--n-value-font-size);
 transition: .3s color var(--n-bezier);
 color: var(--n-value-suffix-text-color);
 `,[f("icon",{verticalAlign:"-0.125em"})])])]),Y=Object.assign(Object.assign({},z.props),{tabularNums:Boolean,label:String,value:[String,Number]}),h=C({name:"Statistic",props:Y,slots:Object,setup(o){const{mergedClsPrefixRef:e,inlineThemeDisabled:i,mergedRtlRef:n}=B(o),u=z("Statistic","-statistic",X,Q,o,e),x=I("Statistic",n,e),l=W(()=>{const{self:{labelFontWeight:S,valueFontSize:N,valueFontWeight:T,valuePrefixTextColor:y,labelTextColor:F,valueSuffixTextColor:R,valueTextColor:w,labelFontSize:O},common:{cubicBezierEaseInOut:$}}=u.value;return{"--n-bezier":$,"--n-label-font-size":O,"--n-label-font-weight":S,"--n-label-text-color":F,"--n-value-font-weight":T,"--n-value-font-size":N,"--n-value-prefix-text-color":y,"--n-value-suffix-text-color":R,"--n-value-text-color":w}}),c=i?P("statistic",void 0,l,o):void 0;return{rtlEnabled:x,mergedClsPrefix:e,cssVars:i?void 0:l,themeClass:c==null?void 0:c.themeClass,onRender:c==null?void 0:c.onRender}},render(){var o;const{mergedClsPrefix:e,$slots:{default:i,label:n,prefix:u,suffix:x}}=this;return(o=this.onRender)===null||o===void 0||o.call(this),r("div",{class:[`${e}-statistic`,this.themeClass,this.rtlEnabled&&`${e}-statistic--rtl`],style:this.cssVars},v(n,l=>r("div",{class:`${e}-statistic__label`},this.label||l)),r("div",{class:`${e}-statistic-value`,style:{fontVariantNumeric:this.tabularNums?"tabular-nums":""}},v(u,l=>l&&r("span",{class:`${e}-statistic-value__prefix`},l)),this.value!==void 0?r("span",{class:`${e}-statistic-value__content`},this.value):v(i,l=>l&&r("span",{class:`${e}-statistic-value__content`},l)),v(x,l=>l&&r("span",{class:`${e}-statistic-value__suffix`},l))))}}),Z={getStats(){return A.get("/dashboard/stats").then(o=>o.data)}},ee=C({__name:"index",setup(o){const e=U({todayOrders:0,totalUsers:0,activeCoupons:0});return E(async()=>{try{const i=await Z.getStats();i.code===0&&(e.value=i.data)}catch{}}),(i,n)=>(k(),j(D,null,{default:t(()=>[n[0]||(n[0]=q("h2",{class:"page-title"},"仪表盘",-1)),a(s(M),{cols:"1 s:2 m:3","x-gap":16,"y-gap":16},{default:t(()=>[a(s(_),null,{default:t(()=>[a(s(g),null,{default:t(()=>[a(s(h),{label:"今日订单"},{prefix:t(()=>[a(s(b),null,{default:t(()=>[a(s(G))]),_:1})]),default:t(()=>[m(" "+p(e.value.todayOrders),1)]),_:1})]),_:1})]),_:1}),a(s(_),null,{default:t(()=>[a(s(g),null,{default:t(()=>[a(s(h),{label:"用户总数"},{prefix:t(()=>[a(s(b),null,{default:t(()=>[a(s(L))]),_:1})]),default:t(()=>[m(" "+p(e.value.totalUsers),1)]),_:1})]),_:1})]),_:1}),a(s(_),null,{default:t(()=>[a(s(g),null,{default:t(()=>[a(s(h),{label:"活跃优惠券"},{prefix:t(()=>[a(s(b),null,{default:t(()=>[a(s(H))]),_:1})]),default:t(()=>[m(" "+p(e.value.activeCoupons),1)]),_:1})]),_:1})]),_:1})]),_:1})]),_:1}))}}),ie=J(ee,[["__scopeId","data-v-9549ee9b"]]);export{ie as default};
