/* Find your Fogo — location finder modal (shared by index.html & san-jose.html) */
(function(){
const LOCS=[
 {id:'sj',city:'San Jose',st:'CA',zip:'95128',ll:[37.3207,-121.9477],dist:'4.2 mi',a1:'377 Santana Row #1090',a2:'San Jose, CA 95128',mgr:'Stefani Rose',img:'assets/lc-sj.jpg',pos:'50% 18%',live:true},
 {id:'em',city:'Emeryville',st:'CA',zip:'94608',ll:[37.8315,-122.2848],dist:'5.6 mi',a1:'5633 Bay Street',a2:'Emeryville, CA 94608',mgr:'Stefani Rose',img:'assets/lc-em.jpg',pos:'50% 50%'},
 {id:'sf',city:'San Francisco',st:'CA',zip:'94103',ll:[37.7826,-122.3965],dist:'7.4 mi',a1:'201 S. 3rd Street Suite 100',a2:'San Francisco, CA 94103',mgr:'Yuri Ouellette',img:'assets/lc-sf.jpg',pos:'50% 4%'}
];
const IC=n=>`assets/lc-${n}.svg`;
let dlg,map,markers={},lastSig='',state={q:'',all:false,sel:null,view:'map',sort:'near'};

function build(){
  dlg=document.createElement('dialog');dlg.id='locDlg';dlg.className='locdlg';dlg.setAttribute('aria-label','Find your Fogo');
  dlg.innerHTML=`
  <div class="ld-main">
    <section class="ld-panel">
      <div class="ld-head">
        <h2 class="ld-h"><b>find your</b> <em>Fogo</em></h2>
        <p class="ld-sub">Connect with a local Sales Manager to plan events of 15 or more guests.</p>
        <label class="ld-search"><img src="${IC('search')}" alt="" width="20" height="20"><input id="ldq" type="search" placeholder="City, state or ZIP" autocomplete="off" aria-label="Search locations"><button type="button" class="ld-clear" aria-label="Clear search"><img src="${IC('close')}" alt="" width="16" height="16"></button></label>
        <div class="ld-row"><button type="button" class="ld-use"><img src="${IC('loc')}" alt="" width="18" height="18">Use my current location</button>
          <div class="ld-toggle" role="group" aria-label="View"><button type="button" data-v="map"></button><button type="button" data-v="grid"></button></div></div>
        <div class="ld-count" hidden><span class="ld-count-t"></span><button type="button" class="ld-sort">Nearest <img src="${IC('chev-d')}" alt="" width="14" height="14"></button></div>
      </div>
      <div class="ld-results" aria-live="polite"></div>
      <div class="ld-sel" hidden><div><small></small><span></span></div><button type="button" class="ld-btn ld-go">Continue</button></div>
    </section>
    <aside class="ld-map"><div id="ldmap" role="application" aria-label="Map of Fogo de Chão locations"></div></aside>
  </div>
  <footer class="ld-foot"><p><span>Party of 14 or fewer? <a href="#" data-t="Reservations (demo)">Reserve a table</a></span><span>Planning for the office? <a href="#" data-t="Catering (demo)">Order catering</a></span></p>
    <a class="ld-mail" href="mailto:groupevents@fogo.com"><img src="${IC('mail')}" alt="" width="16" height="16">groupevents@fogo.com</a></footer>
  <button type="button" class="ld-x" aria-label="Close"><img src="${IC('close-lg')}" alt="" width="20" height="20"></button>`;
  document.body.appendChild(dlg);
  const $=s=>dlg.querySelector(s);
  const inp=$('#ldq');
  $('.ld-x').onclick=()=>dlg.close();
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});
  inp.addEventListener('input',()=>{state.q=inp.value;state.all=false;render()});
  $('.ld-clear').onclick=()=>{inp.value='';state.q='';state.all=false;render();inp.focus()};
  $('.ld-use').onclick=()=>{toast('Finding your location…');setTimeout(()=>{inp.value='San Jose, CA';state.q=inp.value;state.all=false;render()},600)};
  $('.ld-sort').onclick=()=>{state.sort=state.sort==='near'?'az':'near';render()};
  $('.ld-toggle').onclick=e=>{const b=e.target.closest('button');if(b){state.view=b.dataset.v;render()}};
  $('.ld-results').addEventListener('click',e=>{
    if(e.target.closest('.ld-below')){state.all=true;render();return}
    if(e.target.closest('.ld-viewall')){state.all=true;state.q='';inp.value='';render();return}
    const b=e.target.closest('[data-sel]');if(b){state.sel=state.sel===b.dataset.sel?null:b.dataset.sel;render()}
  });
  $('.ld-go').onclick=()=>{
    const l=LOCS.find(x=>x.id===state.sel);if(!l)return;
    if(l.live){
      if(/san-jose\.html$/.test(location.pathname)){dlg.close();toast('Already viewing San Jose group dining')}
      else{toast('Taking you to Fogo de Chão San Jose…');setTimeout(()=>location.href='san-jose.html',450)}
    }else toast(`Demo: ${l.city}, ${l.st} group dining page isn't built yet. Try San Jose.`);
  };
  dlg.querySelectorAll('.ld-foot a[data-t]').forEach(a=>a.onclick=e=>{e.preventDefault();toast(a.dataset.t)});
}


/* ---------- interactive map (Leaflet + CARTO light tiles) ---------- */
let leafletP;
function loadLeaflet(){
  if(window.L)return Promise.resolve();
  if(leafletP)return leafletP;
  leafletP=new Promise((res,rej)=>{
    const l=document.createElement('link');l.rel='stylesheet';l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(l);
    const sc=document.createElement('script');sc.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';sc.onload=res;sc.onerror=rej;document.head.appendChild(sc);
  });
  return leafletP;
}
function pin(sel){return L.divIcon({className:'ld-pin'+(sel?' is-sel':''),iconSize:sel?[34,34]:[28,28],iconAnchor:sel?[17,17]:[14,14]})}
function initMap(){
  if(map||!window.L)return;
  map=L.map(dlg.querySelector('#ldmap'),{zoomControl:true,worldCopyJump:true,minZoom:3,maxZoom:16}).setView([39.5,-98.35],4);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',{maxZoom:16,attribution:'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, OpenStreetMap contributors'}).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',{maxZoom:16}).addTo(map);
  LOCS.forEach(l=>{
    const m=L.marker(l.ll,{icon:pin(false),keyboard:true,title:`${l.city}, ${l.st}`}).bindTooltip(`${l.city}, ${l.st}`,{direction:'top',offset:[0,-14]});
    m.on('click',()=>{state.sel=state.sel===l.id?null:l.id;render()});
    markers[l.id]=m;
  });
}
function syncMap(list){
  if(!map)return;
  map.invalidateSize();
  LOCS.forEach(l=>{
    const m=markers[l.id],on=list.includes(l);
    if(on&&!map.hasLayer(m))m.addTo(map);
    if(!on&&map.hasLayer(m))map.removeLayer(m);
    m.setIcon(pin(state.sel===l.id));
  });
  const sig=list.map(l=>l.id).join();
  if(sig!==lastSig){
    lastSig=sig;
    if(list.length)map.fitBounds(L.latLngBounds(list.map(l=>l.ll)),{padding:[60,60],maxZoom:11,animate:true});
    else map.setView([39.5,-98.35],4);
  }
  const s=LOCS.find(x=>x.id===state.sel);
  if(s&&map.getBounds().pad(-.1).contains(s.ll)===false)map.panTo(s.ll);
}

function matches(){
  const q=state.q.trim().toLowerCase();
  if(state.all)return LOCS.slice();
  if(!q)return [];
  const hit=LOCS.find(l=>(l.city+', '+l.st+' '+l.zip).toLowerCase().includes(q)||q.replace(/[, ]+/g,' ')===(l.city+' '+l.st).toLowerCase());
  /* demo: any match shows the nearby Bay Area locations, matched city first */
  return hit?[hit,...LOCS.filter(l=>l!==hit)]:[];
}
function card(l,grid){
  const sel=state.sel===l.id;
  return `<article class="ld-card${sel?' is-sel':''}">${grid?`<div class="ld-ph"><img src="${l.img}" alt="" style="object-position:${l.pos}" loading="lazy"></div>`:''}
    <div class="ld-cb"><div class="ld-top"><h3>${l.city}, ${l.st}</h3>${grid?'':`<span>${l.dist}</span>`}</div>
    <p>${l.a1}${grid?'<br>':' '}${l.a2}</p>
    <div class="ld-meta"><img src="${IC('users')}" alt="" width="16" height="16">15–65 guests · 3 ${grid?'rooms':'private rooms'}</div>
    <div class="ld-meta"><img src="${IC('user')}" alt="" width="16" height="16">Sales Manager: ${l.mgr}</div>
    <button type="button" class="ld-btn${sel?' is-sel':''}" data-sel="${l.id}" aria-pressed="${sel}">${sel?'selected':'select'}</button></div></article>`;
}
function render(){
  const $=s=>dlg.querySelector(s);
  const grid=state.view==='grid';
  dlg.dataset.view=state.view;
  let list=matches();
  if(state.sort==='az')list=list.slice().sort((a,b)=>a.city.localeCompare(b.city));
  $('.ld-clear').style.visibility=state.q?'visible':'hidden';
  $('.ld-toggle').innerHTML=`<button type="button" data-v="map" class="${grid?'':'on'}" aria-pressed="${!grid}"><img src="${IC(grid?'map':'map-w')}" alt="" width="16" height="16">Map</button><button type="button" data-v="grid" class="${grid?'on':''}" aria-pressed="${grid}"><img src="${IC(grid?'list-w':'list')}" alt="" width="16" height="16">Grid</button>`;
  const cnt=$('.ld-count');cnt.hidden=!list.length;
  if(list.length){
    const c=state.all?LOCS[0]:list[0];
    $('.ld-count-t').textContent=`${list.length} locations near ${c.city}, ${c.st}`;
    $('.ld-sort').firstChild.textContent=state.sort==='near'?'Nearest ':'A–Z ';
  }
  const R=$('.ld-results');
  if(!list.length){
    R.innerHTML=`<div class="ld-none"><h3>No Restaurants were found.</h3><p>${state.q.trim()?'We couldn’t find a match. Try “San Jose”, or view a list of our ':'Looks like we can’t find you. Please enable location services or view a list of our '}<button type="button" class="ld-below">locations below.</button></p></div>`;
  }else{
    R.innerHTML=grid?`<div class="ld-grid">${list.map(l=>card(l,true)).join('')}</div><button type="button" class="ld-btn ld-outline ld-viewall">view all locations</button>`:list.map(l=>card(l,false)).join('');
  }
  syncMap(list);
  const s=LOCS.find(x=>x.id===state.sel),bar=$('.ld-sel');
  bar.hidden=!s;
  if(s){bar.querySelector('small').textContent=`SELECTED · ${s.city}, ${s.st}`;bar.querySelector('span').textContent=`Plan with ${s.mgr}`}
}
window.openLocations=function(opts){
  if(!dlg)build();
  state={q:(opts&&opts.prefill)||'',all:false,sel:null,view:'map',sort:'near'};
  dlg.querySelector('#ldq').value=state.q;
  lastSig='';render();dlg.showModal();dlg.querySelector('#ldq').focus();
  loadLeaflet().then(()=>{initMap();render()}).catch(()=>{});
};
})();
