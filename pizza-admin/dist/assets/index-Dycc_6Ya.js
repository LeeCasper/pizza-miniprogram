import{j as d,C as k,D as a,E as o,k as p,d as C,l as v,m as G,G as T,p as z,H as A,v as M,x as L,w as g,r as h,o as x,h as _,a as y,c as P,A as F,F as V,b as $,e as j,g as I,y as W}from"./index-C_OtW0i9.js";import{o as q}from"./order-Bl8gohSr.js";import{A as H,a as K}from"./AdminLayout-DSLzkhmW.js";import{b as J,B,_ as O}from"./_plugin-vue_export-helper-CckW2H24.js";import{u as Q}from"./use-message-BcgHUIVz.js";import{N as U}from"./DataTable-CUwwP8rx.js";import"./Select-Cgubt9ur.js";import"./Pagination-Du2NS1Bz.js";const t="0!important",N="-1px!important";function s(e){return o(`${e}-type`,[a("& +",[d("button",{},[o(`${e}-type`,[p("border",{borderLeftWidth:t}),p("state-border",{left:N})])])])])}function i(e){return o(`${e}-type`,[a("& +",[d("button",[o(`${e}-type`,[p("border",{borderTopWidth:t}),p("state-border",{top:N})])])])])}const X=d("button-group",`
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
 `),i("default"),o("ghost",[i("primary"),i("info"),i("success"),i("warning"),i("error")])])])]),Y={size:String,vertical:Boolean},Z=C({name:"ButtonGroup",props:Y,setup(e){const{mergedClsPrefixRef:n,mergedRtlRef:f}=G(e);return T("-button-group",X,n),A(J,e),{rtlEnabled:z("ButtonGroup",f,n),mergedClsPrefix:n}},render(){const{mergedClsPrefix:e}=this;return v("div",{class:[`${e}-button-group`,this.rtlEnabled&&`${e}-button-group--rtl`,this.vertical&&`${e}-button-group--vertical`],role:"group"},this.$slots)}}),tt={class:"status-tabs"},et=C({__name:"index",setup(e){const n=j(),f=Q(),m=h([]),b=h(!1),c=h("all"),E=[{label:"全部",value:"all"},{label:"待处理",value:"waiting"},{label:"制作中",value:"preparing"},{label:"已完成",value:"completed"},{label:"已取消",value:"cancelled"}],R={waiting:{label:"待处理",type:"warning"},preparing:{label:"制作中",type:"info"},completed:{label:"已完成",type:"success"},cancelled:{label:"已取消",type:"error"}},S=[{title:"订单号",key:"id",width:160,ellipsis:{tooltip:!0}},{title:"用户",key:"userName",width:100,ellipsis:{tooltip:!0}},{title:"状态",key:"status",width:80,render(r){const u=R[r.status]||{label:r.status,type:"default"};return v(K,{size:"small",type:u.type,bordered:!1},{default:()=>u.label})}},{title:"金额",key:"total",width:80,render(r){return`¥${Number(r.total).toFixed(2)}`}},{title:"取餐码",key:"pickupCode",width:80},{title:"时间",key:"createdAt",width:160,ellipsis:{tooltip:!0}},{title:"操作",key:"actions",width:60,render(r){return v(B,{size:"tiny",quaternary:!0,onClick:()=>n.push(`/orders/${r.id}`)},{default:()=>"详情"})}}];M(w);async function w(){b.value=!0;try{const r=await q.list({status:c.value==="all"?void 0:c.value});r.code===0&&(m.value=r.data)}catch{f.error("加载订单失败")}finally{b.value=!1}}function D(r){c.value=r,w()}return(r,u)=>(x(),L(H,null,{default:g(()=>[u[0]||(u[0]=_("h2",{class:"page-title"},"订单管理",-1)),_("div",tt,[y($(Z),null,{default:g(()=>[(x(),P(V,null,F(E,l=>y($(B),{key:l.value,type:c.value===l.value?"primary":"default",size:"small",onClick:rt=>D(l.value)},{default:g(()=>[I(W(l.label),1)]),_:2},1032,["type","onClick"])),64))]),_:1})]),y($(U),{columns:S,data:m.value,loading:b.value,"row-key":l=>l.id},null,8,["data","loading","row-key"])]),_:1}))}}),ct=O(et,[["__scopeId","data-v-80bc46d9"]]);export{ct as default};
