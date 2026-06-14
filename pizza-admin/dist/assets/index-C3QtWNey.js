import{k as te,Q as $,N as z,A as o,M as oe,O as T,B as W,R as re,S as le,d as H,m as b,T as ne,s as ae,C as Z,E as se,i as L,U as V,t as ie,G as U,w as d,I as de,r as J,o as K,a as s,b as n,g as y,h as D,H as C,J as ce,e as pe}from"./index-BenBNlxJ.js";import{o as E}from"./order-B5Gs5bzL.js";import{f as be,g as ue,u as ge,A as me,c as Q,a as he}from"./AdminLayout-BlZ-XquH.js";import{B as fe,_ as ve}from"./_plugin-vue_export-helper-CTb7Iu_N.js";import{u as xe}from"./use-message-6MB0XOVM.js";import{N as ye}from"./Card-CGBsiLc1.js";import{N as X}from"./Divider-D0EVhSHZ.js";import{N as Ce}from"./Select-C5GepyfX.js";import{N as Se}from"./DataTable-DZS1-WNC.js";function Y(l,u="default",h=[]){const{children:a}=l;if(a!==null&&typeof a=="object"&&!Array.isArray(a)){const t=a[u];if(typeof t=="function")return t()}return h}const we={thPaddingBorderedSmall:"8px 12px",thPaddingBorderedMedium:"12px 16px",thPaddingBorderedLarge:"16px 24px",thPaddingSmall:"0",thPaddingMedium:"0",thPaddingLarge:"0",tdPaddingBorderedSmall:"8px 12px",tdPaddingBorderedMedium:"12px 16px",tdPaddingBorderedLarge:"16px 24px",tdPaddingSmall:"0 0 8px 0",tdPaddingMedium:"0 0 12px 0",tdPaddingLarge:"0 0 16px 0"};function ze(l){const{tableHeaderColor:u,textColor2:h,textColor1:a,cardColor:t,modalColor:m,popoverColor:v,dividerColor:g,borderRadius:i,fontWeightStrong:c,lineHeight:p,fontSizeSmall:e,fontSizeMedium:f,fontSizeLarge:x}=l;return Object.assign(Object.assign({},we),{lineHeight:p,fontSizeSmall:e,fontSizeMedium:f,fontSizeLarge:x,titleTextColor:a,thColor:$(t,u),thColorModal:$(m,u),thColorPopover:$(v,u),thTextColor:a,thFontWeight:c,tdTextColor:h,tdColor:t,tdColorModal:m,tdColorPopover:v,borderColor:$(t,g),borderColorModal:$(m,g),borderColorPopover:$(v,g),borderRadius:i})}const Pe={common:te,self:ze},_e=z([o("descriptions",{fontSize:"var(--n-font-size)"},[o("descriptions-separator",`
 display: inline-block;
 margin: 0 8px 0 2px;
 `),o("descriptions-table-wrapper",[o("descriptions-table",[o("descriptions-table-row",[o("descriptions-table-header",{padding:"var(--n-th-padding)"}),o("descriptions-table-content",{padding:"var(--n-td-padding)"})])])]),oe("bordered",[o("descriptions-table-wrapper",[o("descriptions-table",[o("descriptions-table-row",[z("&:last-child",[o("descriptions-table-content",{paddingBottom:0})])])])])]),T("left-label-placement",[o("descriptions-table-content",[z("> *",{verticalAlign:"top"})])]),T("left-label-align",[z("th",{textAlign:"left"})]),T("center-label-align",[z("th",{textAlign:"center"})]),T("right-label-align",[z("th",{textAlign:"right"})]),T("bordered",[o("descriptions-table-wrapper",`
 border-radius: var(--n-border-radius);
 overflow: hidden;
 background: var(--n-merged-td-color);
 border: 1px solid var(--n-merged-border-color);
 `,[o("descriptions-table",[o("descriptions-table-row",[z("&:not(:last-child)",[o("descriptions-table-content",{borderBottom:"1px solid var(--n-merged-border-color)"}),o("descriptions-table-header",{borderBottom:"1px solid var(--n-merged-border-color)"})]),o("descriptions-table-header",`
 font-weight: 400;
 background-clip: padding-box;
 background-color: var(--n-merged-th-color);
 `,[z("&:not(:last-child)",{borderRight:"1px solid var(--n-merged-border-color)"})]),o("descriptions-table-content",[z("&:not(:last-child)",{borderRight:"1px solid var(--n-merged-border-color)"})])])])])]),o("descriptions-header",`
 font-weight: var(--n-th-font-weight);
 font-size: 18px;
 transition: color .3s var(--n-bezier);
 line-height: var(--n-line-height);
 margin-bottom: 16px;
 color: var(--n-title-text-color);
 `),o("descriptions-table-wrapper",`
 transition:
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[o("descriptions-table",`
 width: 100%;
 border-collapse: separate;
 border-spacing: 0;
 box-sizing: border-box;
 `,[o("descriptions-table-row",`
 box-sizing: border-box;
 transition: border-color .3s var(--n-bezier);
 `,[o("descriptions-table-header",`
 font-weight: var(--n-th-font-weight);
 line-height: var(--n-line-height);
 display: table-cell;
 box-sizing: border-box;
 color: var(--n-th-text-color);
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `),o("descriptions-table-content",`
 vertical-align: top;
 line-height: var(--n-line-height);
 display: table-cell;
 box-sizing: border-box;
 color: var(--n-td-text-color);
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[W("content",`
 transition: color .3s var(--n-bezier);
 display: inline-block;
 color: var(--n-td-text-color);
 `)]),W("label",`
 font-weight: var(--n-th-font-weight);
 transition: color .3s var(--n-bezier);
 display: inline-block;
 margin-right: 14px;
 color: var(--n-th-text-color);
 `)])])])]),o("descriptions-table-wrapper",`
 --n-merged-th-color: var(--n-th-color);
 --n-merged-td-color: var(--n-td-color);
 --n-merged-border-color: var(--n-border-color);
 `),re(o("descriptions-table-wrapper",`
 --n-merged-th-color: var(--n-th-color-modal);
 --n-merged-td-color: var(--n-td-color-modal);
 --n-merged-border-color: var(--n-border-color-modal);
 `)),le(o("descriptions-table-wrapper",`
 --n-merged-th-color: var(--n-th-color-popover);
 --n-merged-td-color: var(--n-td-color-popover);
 --n-merged-border-color: var(--n-border-color-popover);
 `))]),ee="DESCRIPTION_ITEM_FLAG";function $e(l){return typeof l=="object"&&l&&!Array.isArray(l)?l.type&&l.type[ee]:!1}const Ne=Object.assign(Object.assign({},Z.props),{title:String,column:{type:Number,default:3},columns:Number,labelPlacement:{type:String,default:"top"},labelAlign:{type:String,default:"left"},separator:{type:String,default:":"},size:String,bordered:Boolean,labelClass:String,labelStyle:[Object,String],contentClass:String,contentStyle:[Object,String]}),Re=H({name:"Descriptions",props:Ne,slots:Object,setup(l){const{mergedClsPrefixRef:u,inlineThemeDisabled:h,mergedComponentPropsRef:a}=ae(l),t=L(()=>{var i,c;return l.size||((c=(i=a==null?void 0:a.value)===null||i===void 0?void 0:i.Descriptions)===null||c===void 0?void 0:c.size)||"medium"}),m=Z("Descriptions","-descriptions",_e,Pe,l,u),v=L(()=>{const{bordered:i}=l,c=t.value,{common:{cubicBezierEaseInOut:p},self:{titleTextColor:e,thColor:f,thColorModal:x,thColorPopover:O,thTextColor:I,thFontWeight:q,tdTextColor:j,tdColor:r,tdColorModal:N,tdColorPopover:F,borderColor:w,borderColorModal:P,borderColorPopover:R,borderRadius:k,lineHeight:_,[V("fontSize",c)]:B,[V(i?"thPaddingBordered":"thPadding",c)]:M,[V(i?"tdPaddingBordered":"tdPadding",c)]:A}}=m.value;return{"--n-title-text-color":e,"--n-th-padding":M,"--n-td-padding":A,"--n-font-size":B,"--n-bezier":p,"--n-th-font-weight":q,"--n-line-height":_,"--n-th-text-color":I,"--n-td-text-color":j,"--n-th-color":f,"--n-th-color-modal":x,"--n-th-color-popover":O,"--n-td-color":r,"--n-td-color-modal":N,"--n-td-color-popover":F,"--n-border-radius":k,"--n-border-color":w,"--n-border-color-modal":P,"--n-border-color-popover":R}}),g=h?se("descriptions",L(()=>{let i="";const{bordered:c}=l;return c&&(i+="a"),i+=t.value[0],i}),v,l):void 0;return{mergedClsPrefix:u,cssVars:h?void 0:v,themeClass:g==null?void 0:g.themeClass,onRender:g==null?void 0:g.onRender,compitableColumn:ge(l,["columns","column"]),inlineThemeDisabled:h,mergedSize:t}},render(){const l=this.$slots.default,u=l?be(l()):[];u.length;const{contentClass:h,labelClass:a,compitableColumn:t,labelPlacement:m,labelAlign:v,mergedSize:g,bordered:i,title:c,cssVars:p,mergedClsPrefix:e,separator:f,onRender:x}=this;x==null||x();const O=u.filter(r=>$e(r)),I={span:0,row:[],secondRow:[],rows:[]},j=O.reduce((r,N,F)=>{const w=N.props||{},P=O.length-1===F,R=["label"in w?w.label:Y(N,"label")],k=[Y(N)],_=w.span||1,B=r.span;r.span+=_;const M=w.labelStyle||w["label-style"]||this.labelStyle,A=w.contentStyle||w["content-style"]||this.contentStyle;if(m==="left")i?r.row.push(b("th",{class:[`${e}-descriptions-table-header`,a],colspan:1,style:M},R),b("td",{class:[`${e}-descriptions-table-content`,h],colspan:P?(t-B)*2+1:_*2-1,style:A},k)):r.row.push(b("td",{class:`${e}-descriptions-table-content`,colspan:P?(t-B)*2:_*2},b("span",{class:[`${e}-descriptions-table-content__label`,a],style:M},[...R,f&&b("span",{class:`${e}-descriptions-separator`},f)]),b("span",{class:[`${e}-descriptions-table-content__content`,h],style:A},k)));else{const G=P?(t-B)*2:_*2;r.row.push(b("th",{class:[`${e}-descriptions-table-header`,a],colspan:G,style:M},R)),r.secondRow.push(b("td",{class:[`${e}-descriptions-table-content`,h],colspan:G,style:A},k))}return(r.span>=t||P)&&(r.span=0,r.row.length&&(r.rows.push(r.row),r.row=[]),m!=="left"&&r.secondRow.length&&(r.rows.push(r.secondRow),r.secondRow=[])),r},I).rows.map(r=>b("tr",{class:`${e}-descriptions-table-row`},r));return b("div",{style:p,class:[`${e}-descriptions`,this.themeClass,`${e}-descriptions--${m}-label-placement`,`${e}-descriptions--${v}-label-align`,`${e}-descriptions--${g}-size`,i&&`${e}-descriptions--bordered`]},c||this.$slots.header?b("div",{class:`${e}-descriptions-header`},c||ue(this,"header")):null,b("div",{class:`${e}-descriptions-table-wrapper`},b("table",{class:`${e}-descriptions-table`},b("tbody",null,m==="top"&&b("tr",{class:`${e}-descriptions-table-row`,style:{visibility:"collapse"}},ne(t*2,b("td",null))),j))))}}),ke={label:String,span:{type:Number,default:1},labelClass:String,labelStyle:[Object,String],contentClass:String,contentStyle:[Object,String]},S=H({name:"DescriptionsItem",[ee]:!0,props:ke,slots:Object,render(){return null}}),Be={style:{"font-size":"18px","font-weight":"700",color:"#D32F2F"}},Me=H({__name:"index",setup(l){const u=de(),h=pe(),a=xe(),t=J(null),m=J(!1),v=[{label:"待处理",value:"waiting"},{label:"制作中",value:"preparing"},{label:"已完成",value:"completed"},{label:"已取消",value:"cancelled"}],g={waiting:{label:"待处理",type:"warning"},preparing:{label:"制作中",type:"info"},completed:{label:"已完成",type:"success"},cancelled:{label:"已取消",type:"error"}},i=[{title:"商品",key:"productName"},{title:"单价",key:"price",render(p){return`¥${Number(p.price).toFixed(2)}`}},{title:"数量",key:"quantity"},{title:"小计",key:"subtotal",render(p){return`¥${(p.price*p.quantity).toFixed(2)}`}}];ie(async()=>{m.value=!0;try{const p=await E.get(u.params.id);p.code===0&&(t.value=p.data)}catch{a.error("加载订单失败")}finally{m.value=!1}});async function c(p){try{await E.updateStatus(u.params.id,p),a.success("状态已更新");const e=await E.get(u.params.id);e.code===0&&(t.value=e.data)}catch{a.error("更新失败")}}return(p,e)=>(K(),U(me,null,{default:d(()=>[s(n(Q),{align:"center",style:{"margin-bottom":"16px"}},{default:d(()=>[s(n(fe),{quaternary:"",onClick:e[0]||(e[0]=f=>n(h).push("/orders"))},{default:d(()=>[...e[1]||(e[1]=[y("← 返回",-1)])]),_:1}),e[2]||(e[2]=D("h2",{class:"page-title"},"订单详情",-1))]),_:1}),t.value?(K(),U(n(ye),{key:0,loading:m.value},{default:d(()=>[s(n(Re),{"label-placement":"left",column:2},{default:d(()=>[s(n(S),{label:"订单号"},{default:d(()=>[y(C(t.value.id),1)]),_:1}),s(n(S),{label:"用户"},{default:d(()=>[y(C(t.value.userName),1)]),_:1}),s(n(S),{label:"取餐码"},{default:d(()=>[D("code",Be,C(t.value.pickupCode),1)]),_:1}),s(n(S),{label:"门店"},{default:d(()=>[y(C(t.value.storeName||"—"),1)]),_:1}),s(n(S),{label:"状态"},{default:d(()=>{var f;return[s(n(he),{type:((f=g[t.value.status])==null?void 0:f.type)||"default",size:"small",bordered:!1},{default:d(()=>{var x;return[y(C(((x=g[t.value.status])==null?void 0:x.label)||t.value.status),1)]}),_:1},8,["type"])]}),_:1}),s(n(S),{label:"总金额"},{default:d(()=>[y("¥"+C(Number(t.value.total).toFixed(2)),1)]),_:1}),s(n(S),{label:"折扣"},{default:d(()=>[y("¥"+C(Number(t.value.discountAmount||0).toFixed(2)),1)]),_:1}),s(n(S),{label:"实付"},{default:d(()=>[y("¥"+C(Number(t.value.paidAmount||t.value.total).toFixed(2)),1)]),_:1}),s(n(S),{label:"备注"},{default:d(()=>[y(C(t.value.note||"—"),1)]),_:1}),s(n(S),{label:"下单时间"},{default:d(()=>[y(C(t.value.createdAt),1)]),_:1})]),_:1}),s(n(X)),e[3]||(e[3]=D("h4",null,"状态变更",-1)),s(n(Q),null,{default:d(()=>[s(n(Ce),{value:t.value.status,options:v,style:{width:"140px"},"onUpdate:value":c},null,8,["value"])]),_:1}),s(n(X)),e[4]||(e[4]=D("h4",null,"商品明细",-1)),s(n(Se),{columns:i,data:t.value.items||[],"row-key":f=>f.id},null,8,["data","row-key"])]),_:1},8,["loading"])):ce("",!0)]),_:1}))}}),Ee=ve(Me,[["__scopeId","data-v-d7f54884"]]);export{Ee as default};
