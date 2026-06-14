import{d as C,k as v,s as T,p as D,y as G,w as g,r as h,o as w,h as x,a as y,c as M,C as A,F as L,b as $,e as P,g as F,z as V}from"./index-CEpvOXI_.js";import{o as j}from"./order-gG4hyg-h.js";import{A as I,a as W}from"./AdminLayout-B0OuyR_O.js";import{b as d,j as _,k as a,l as o,e as p,u as q,m as K,g as H,n as J,B,_ as O}from"./_plugin-vue_export-helper-B5iuTD4Z.js";import{u as Q}from"./use-message-Dafi8dLU.js";import{N as U}from"./DataTable-C9gvT1qU.js";import"./Select-BhRSiMjN.js";const t="0!important",N="-1px!important";function s(e){return o(`${e}-type`,[a("& +",[d("button",{},[o(`${e}-type`,[p("border",{borderLeftWidth:t}),p("state-border",{left:N})])])])])}function i(e){return o(`${e}-type`,[a("& +",[d("button",[o(`${e}-type`,[p("border",{borderTopWidth:t}),p("state-border",{top:N})])])])])}const X=d("button-group",`
 flex-wrap: nowrap;
 display: inline-flex;
 position: relative;
`,[_("vertical",{flexDirection:"row"},[_("rtl",[d("button",[a("&:first-child:not(:last-child)",`
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
 `),i("default"),o("ghost",[i("primary"),i("info"),i("success"),i("warning"),i("error")])])])]),Y={size:String,vertical:Boolean},Z=C({name:"ButtonGroup",props:Y,setup(e){const{mergedClsPrefixRef:n,mergedRtlRef:f}=q(e);return K("-button-group",X,n),T(J,e),{rtlEnabled:H("ButtonGroup",f,n),mergedClsPrefix:n}},render(){const{mergedClsPrefix:e}=this;return v("div",{class:[`${e}-button-group`,this.rtlEnabled&&`${e}-button-group--rtl`,this.vertical&&`${e}-button-group--vertical`],role:"group"},this.$slots)}}),tt={class:"status-tabs"},et=C({__name:"index",setup(e){const n=P(),f=Q(),m=h([]),b=h(!1),c=h("all"),R=[{label:"全部",value:"all"},{label:"待处理",value:"waiting"},{label:"制作中",value:"preparing"},{label:"已完成",value:"completed"},{label:"已取消",value:"cancelled"}],S={waiting:{label:"待处理",type:"warning"},preparing:{label:"制作中",type:"info"},completed:{label:"已完成",type:"success"},cancelled:{label:"已取消",type:"error"}},z=[{title:"订单号",key:"id",width:160,ellipsis:{tooltip:!0}},{title:"用户",key:"userName",width:100,ellipsis:{tooltip:!0}},{title:"状态",key:"status",width:80,render(r){const u=S[r.status]||{label:r.status,type:"default"};return v(W,{size:"small",type:u.type,bordered:!1},{default:()=>u.label})}},{title:"金额",key:"total",width:80,render(r){return`¥${Number(r.total).toFixed(2)}`}},{title:"取餐码",key:"pickupCode",width:80},{title:"时间",key:"createdAt",width:160,ellipsis:{tooltip:!0}},{title:"操作",key:"actions",width:60,render(r){return v(B,{size:"tiny",quaternary:!0,onClick:()=>n.push(`/orders/${r.id}`)},{default:()=>"详情"})}}];D(k);async function k(){b.value=!0;try{const r=await j.list({status:c.value==="all"?void 0:c.value});r.code===0&&(m.value=r.data)}catch{f.error("加载订单失败")}finally{b.value=!1}}function E(r){c.value=r,k()}return(r,u)=>(w(),G(I,null,{default:g(()=>[u[0]||(u[0]=x("h2",{class:"page-title"},"订单管理",-1)),x("div",tt,[y($(Z),null,{default:g(()=>[(w(),M(L,null,A(R,l=>y($(B),{key:l.value,type:c.value===l.value?"primary":"default",size:"small",onClick:rt=>E(l.value)},{default:g(()=>[F(V(l.label),1)]),_:2},1032,["type","onClick"])),64))]),_:1})]),y($(U),{columns:z,data:m.value,loading:b.value,"row-key":l=>l.id},null,8,["data","loading","row-key"])]),_:1}))}}),dt=O(et,[["__scopeId","data-v-80bc46d9"]]);export{dt as default};
