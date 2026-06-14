import{A as d,M as k,N as a,O as o,B as p,d as C,m as v,s as G,P as M,D as T,y as z,t as A,G as L,w as g,r as h,o as x,h as _,a as y,c as P,K as V,L as F,b as $,e as I,g as K,H as W}from"./index-BenBNlxJ.js";import{o as j}from"./order-B5Gs5bzL.js";import{A as q,a as H}from"./AdminLayout-BlZ-XquH.js";import{b as O,B,_ as J}from"./_plugin-vue_export-helper-CTb7Iu_N.js";import{u as Q}from"./use-message-6MB0XOVM.js";import{N as U}from"./DataTable-DZS1-WNC.js";import"./Select-C5GepyfX.js";const t="0!important",N="-1px!important";function s(e){return o(`${e}-type`,[a("& +",[d("button",{},[o(`${e}-type`,[p("border",{borderLeftWidth:t}),p("state-border",{left:N})])])])])}function i(e){return o(`${e}-type`,[a("& +",[d("button",[o(`${e}-type`,[p("border",{borderTopWidth:t}),p("state-border",{top:N})])])])])}const X=d("button-group",`
 flex-wrap: nowrap;
 display: inline-flex;
 position: relative;
`,[k("vertical",{flexDirection:"row"},[k("rtl",[d("button",[a("&:first-child:not(:last-child)",`
 margin-right: ${t};
 border-top-right-radius: ${t};
 border-bottom-right-radius: ${t};
 `),a("&:last-child:not(:first-child)",`
 margin-left: ${t};
 border-top-left-radius: ${t};
 border-bottom-left-radius: ${t};
 `),a("&:not(:first-child):not(:last-child)",`
 margin-left: ${t};
 margin-right: ${t};
 border-radius: ${t};
 `),s("default"),o("ghost",[s("primary"),s("info"),s("success"),s("warning"),s("error")])])])]),o("vertical",{flexDirection:"column"},[d("button",[a("&:first-child:not(:last-child)",`
 margin-bottom: ${t};
 margin-left: ${t};
 margin-right: ${t};
 border-bottom-left-radius: ${t};
 border-bottom-right-radius: ${t};
 `),a("&:last-child:not(:first-child)",`
 margin-top: ${t};
 margin-left: ${t};
 margin-right: ${t};
 border-top-left-radius: ${t};
 border-top-right-radius: ${t};
 `),a("&:not(:first-child):not(:last-child)",`
 margin: ${t};
 border-radius: ${t};
 `),i("default"),o("ghost",[i("primary"),i("info"),i("success"),i("warning"),i("error")])])])]),Y={size:String,vertical:Boolean},Z=C({name:"ButtonGroup",props:Y,setup(e){const{mergedClsPrefixRef:n,mergedRtlRef:f}=G(e);return M("-button-group",X,n),z(O,e),{rtlEnabled:T("ButtonGroup",f,n),mergedClsPrefix:n}},render(){const{mergedClsPrefix:e}=this;return v("div",{class:[`${e}-button-group`,this.rtlEnabled&&`${e}-button-group--rtl`,this.vertical&&`${e}-button-group--vertical`],role:"group"},this.$slots)}}),tt={class:"status-tabs"},et=C({__name:"index",setup(e){const n=I(),f=Q(),m=h([]),b=h(!1),c=h("all"),R=[{label:"全部",value:"all"},{label:"待处理",value:"waiting"},{label:"制作中",value:"preparing"},{label:"已完成",value:"completed"},{label:"已取消",value:"cancelled"}],S={waiting:{label:"待处理",type:"warning"},preparing:{label:"制作中",type:"info"},completed:{label:"已完成",type:"success"},cancelled:{label:"已取消",type:"error"}},D=[{title:"订单号",key:"id",width:160,ellipsis:{tooltip:!0}},{title:"用户",key:"userName",width:100,ellipsis:{tooltip:!0}},{title:"状态",key:"status",width:80,render(r){const u=S[r.status]||{label:r.status,type:"default"};return v(H,{size:"small",type:u.type,bordered:!1},{default:()=>u.label})}},{title:"金额",key:"total",width:80,render(r){return`¥${Number(r.total).toFixed(2)}`}},{title:"取餐码",key:"pickupCode",width:80},{title:"时间",key:"createdAt",width:160,ellipsis:{tooltip:!0}},{title:"操作",key:"actions",width:60,render(r){return v(B,{size:"tiny",quaternary:!0,onClick:()=>n.push(`/orders/${r.id}`)},{default:()=>"详情"})}}];A(w);async function w(){b.value=!0;try{const r=await j.list({status:c.value==="all"?void 0:c.value});r.code===0&&(m.value=r.data)}catch{f.error("加载订单失败")}finally{b.value=!1}}function E(r){c.value=r,w()}return(r,u)=>(x(),L(q,null,{default:g(()=>[u[0]||(u[0]=_("h2",{class:"page-title"},"订单管理",-1)),_("div",tt,[y($(Z),null,{default:g(()=>[(x(),P(F,null,V(R,l=>y($(B),{key:l.value,type:c.value===l.value?"primary":"default",size:"small",onClick:rt=>E(l.value)},{default:g(()=>[K(W(l.label),1)]),_:2},1032,["type","onClick"])),64))]),_:1})]),y($(U),{columns:D,data:m.value,loading:b.value,"row-key":l=>l.id},null,8,["data","loading","row-key"])]),_:1}))}}),dt=J(et,[["__scopeId","data-v-80bc46d9"]]);export{dt as default};
