import{w as n}from"./chunk-MWEYEL6R.js";function i(){let e=document.getElementsByTagName("head")[0],t=document.createElement("script");t.async=!0,t.src="https://www.googletagmanager.com/gtag/js?id="+n.google_analytics_code;let o=document.createElement("script");o.textContent=`    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', '`+n.google_analytics_code+"',{'cookie_expires':"+n.cookie_store_days+"* 24 * 60 * 60});",e.insertBefore(o,e.firstChild),e.insertBefore(t,e.firstChild)}function s(e,t,o){gtag("config",n.google_analytics_code,{page_path:e,page_title:t,page_location:o,send_page_view:!0})}function r(e,t){Array.isArray(t)&&t.length>0?t.forEach(o=>{Object.entries(o).forEach(([a,g])=>{gtag("event",e,{[a]:g})})}):gtag("event",e,t)}export{i as a,s as b,r as c};
