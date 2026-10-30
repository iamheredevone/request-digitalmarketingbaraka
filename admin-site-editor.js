export function initAdminSiteEditor() {
  const G = "https://digitalmarketing.iamhere-devone.workers.dev/?resource=gallery";
  const E = "https://digitalmarketing.iamhere-devone.workers.dev/?resource=site-editor";
  const $ = (s) => document.querySelector(s);
  let session = "", data = null, selected = { type: "section", section: "hero" }, history = [], hi = -1, busy = false;
  const preview = $("#previewFrame"), layers = $("#layers"), props = $("#properties"), canvasStage = document.querySelector(".canvas-stage");
  const labels = { hero: "Hero", services: "Layanan", custom: "Konten Tambahan", digital: "Materi Digital", gallery: "Galeri", contact: "Kontak" };
  const icons = [
    ["file","File"],["palette","Palet"],["location","Lokasi"],["clipboard","Checklist"],
    ["truck","Truk / Pengiriman"],["box","Paket"],["boxes-stacked","Tumpukan Paket"],
    ["warehouse","Gudang"],["store","Toko"],["building","Gedung"],["map","Peta"],
    ["phone","Telepon"],["envelope","Email"],["comments","Chat"],["bullhorn","Promosi"],
    ["image","Gambar"],["camera","Kamera"],["video","Video"],["bag-shopping","Belanja"],
    ["cart-shopping","Keranjang"],["tag","Label"],["gift","Hadiah"],["star","Bintang"],
    ["heart","Hati"],["calendar-days","Kalender"],["clock","Jam"],["users","Tim"],
    ["user-tie","Profesional"],["handshake","Kemitraan"],["chart-line","Grafik"],
    ["money-bill","Uang"],["credit-card","Pembayaran"],["gear","Pengaturan"],
    ["shield-halved","Keamanan"],["circle-check","Centang"],["circle-info","Info"],
    ["lightbulb","Ide"],["rocket","Roket"],["globe","Web"],["link","Tautan"],
    ["download","Unduh"],["print","Cetak"],["pen","Tulis"],["book","Buku"]
  ];
  const paletteColors = ["#063e67", "#0b6c83", "#16a085", "#f27d12", "#f04353", "#8754e8", "#e8f4f7", "#ffffff"];
  async function req(url, opt = {}) { const r = await fetch(url,opt), j = await r.json().catch(()=>({})); if(!r.ok) throw Error(j.error||j.message||`HTTP ${r.status}`); return j; }
  const headers = () => ({"Content-Type":"application/json","X-Admin-Session":session});
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const list = (s) => data[s].items;
  function normalizeContent(content, defaults) {
    const model=copy(content||defaults);
    model.sections=Array.isArray(model.sections)?model.sections.slice():defaults.sections.slice();
    if(!model.sections.includes("custom"))model.sections.splice(Math.max(0,model.sections.indexOf("services")+1),0,"custom");
    model.theme={...defaults.theme,...model.theme};model.hero={...defaults.hero,...model.hero};
    const surfaceDefaults={background:"",backgroundEnd:"",gradientAngle:135,backgroundOpacity:100,glow:0,glowColor:""};
    model.services={...surfaceDefaults,...defaults.services,...model.services};model.digital={...surfaceDefaults,...defaults.digital,...model.digital};
    model.custom={title:"Konten Tambahan",columns:3,gap:20,items:[],...surfaceDefaults,...defaults.custom,...model.custom,items:Array.isArray(model.custom?.items)?model.custom.items:[]};model.contact={...defaults.contact,...model.contact};
    const styleDefaults={col:0,row:0,rowSpan:1,iconColor:"",iconBg:"",accent:"",backgroundEnd:"",gradientAngle:135,backgroundOpacity:100,glow:0,glowColor:"",radius:"",borderColor:"",borderWidth:0,textAlign:"left"};
    for(const section of ["services","digital","custom"])model[section].items=(model[section].items||[]).map(item=>({...styleDefaults,...item}));
    model.hero={backgroundEnd:"",gradientAngle:135,backgroundOpacity:100,glow:0,glowColor:"",...model.hero};
    return model;
  }
  function status(msg, kind="") { const el=$("#editorStatus"); el.textContent=msg; el.className=`status editor-status ${kind}`; }
  function editorError(error){return String(error&&error.message||error).includes("Struktur halaman tidak valid")?"Worker belum mendukung editor visual. Deploy worker-cloudflare-gallery.js versi terbaru di Cloudflare.":String(error&&error.message||error)}
  function historyPush() { const snap=JSON.stringify(data); if(history[hi]===snap)return; history=history.slice(0,hi+1); history.push(snap); if(history.length>80)history.shift(); hi=history.length-1; $("#undoButton").disabled=hi<=0; $("#redoButton").disabled=hi>=history.length-1; }
  function resizePreviewToContent(){try{const doc=preview.contentDocument;if(!doc)return;const page=doc.querySelector(".page")||doc.body;const height=Math.max(doc.documentElement.scrollHeight,doc.body?doc.body.scrollHeight:0,page?page.getBoundingClientRect().height:0);if(Number.isFinite(height)&&height>0)preview.style.height=`${Math.max(500,Math.min(Math.ceil(height),12000))}px`}catch(_){}}
  function syncPreviewScroll(){try{if(!canvasStage||!preview.contentWindow)return;const frameTop=preview.getBoundingClientRect().top-canvasStage.getBoundingClientRect().top+canvasStage.scrollTop;const scrollY=Math.max(0,canvasStage.scrollTop-frameTop);preview.contentWindow.postMessage({type:"site-editor-preview-scroll",scrollY},location.origin)}catch(_){}}
  function updatePreviewRenderStatus(message){const el=$("#previewRenderStatus");if(!el)return;if(message){el.textContent=message;el.classList.add("is-error");return}if(!data||!preview.contentDocument){el.textContent="Menghubungkan preview…";el.classList.remove("is-error");return}const doc=preview.contentDocument;const counts=[doc.querySelectorAll('[data-editor-section="services"] > .service-card').length,doc.querySelectorAll('[data-editor-section="digital"] .digital-grid > .digital-card').length,doc.querySelectorAll('[data-editor-section="custom"] .custom-content-grid > .custom-block').length];const expected=[data.services.items.length,data.digital.items.length,data.custom.items.length];const ok=counts.every((count,index)=>count===expected[index]);el.textContent=`Preview: Layanan ${counts[0]}/${expected[0]} · Materi ${counts[1]}/${expected[1]} · Elemen ${counts[2]}/${expected[2]}`;el.classList.toggle("is-error",!ok)}
  function revealPreviewSelection(){try{const doc=preview.contentDocument;const stage=document.querySelector(".canvas-stage");if(!doc||!stage)return;const target=selected.type==="item"?doc.querySelector(`[data-editor-section="${selected.section}"] [data-editor-id="${selected.id}"]`):doc.querySelector(`[data-editor-section="${selected.section}"]`);if(!target)return;const frameRect=preview.getBoundingClientRect();const stageRect=stage.getBoundingClientRect();const targetRect=target.getBoundingClientRect();const top=stage.scrollTop+frameRect.top-stageRect.top+targetRect.top;stage.scrollTo({top:Math.max(0,top-14),behavior:"smooth"})}catch(_){}}
  function paint() { if(!data)return;try { const frame=preview.contentWindow; if(typeof frame.__siteEditorApplyContent==="function") { preview.dataset.ready="yes"; bindPreviewInteractions(); frame.__siteEditorApplyContent(data); resizePreviewToContent(); requestAnimationFrame(()=>{resizePreviewToContent();updatePreviewRenderStatus();syncPreviewScroll()}); highlight();updatePreviewRenderStatus();syncPreviewScroll(); } else if(preview.dataset.ready==="yes") { updatePreviewRenderStatus("Menerapkan konten ke preview…");frame.postMessage({type:"site-editor-preview",content:data},location.origin); } else updatePreviewRenderStatus(); } catch(error) { updatePreviewRenderStatus(`Render gagal: ${error.message||error}`);status(`Pratinjau gagal: ${error.message||error}`,"error"); } }
  function highlight() { try { const d=preview.contentDocument; d.querySelectorAll(".site-editor-selected").forEach(x=>x.classList.remove("site-editor-selected")); let el=selected.type==="item"?d.querySelector(`[data-editor-section="${selected.section}"] [data-editor-id="${selected.id}"]`):d.querySelector(`[data-editor-section="${selected.section}"]`); if(el){let st=d.getElementById("editor-outline");if(!st){st=d.createElement("style");st.id="editor-outline";st.textContent=".site-editor-selected{outline:3px solid #11a0be!important;outline-offset:3px!important;cursor:crosshair!important}";d.head.append(st)}el.classList.add("site-editor-selected")}}catch(_){} drawOverlay(); }
  function layer(label, type, section, itemId) {
    const b=document.createElement("button"); b.type="button"; b.draggable=true; b.className=`layer-button ${type}${selected.section===section&&((type==="section"&&selected.type==="section")||(type==="item"&&selected.type==="item"&&selected.id===itemId))?" active":""}`; b.dataset.kind=type;b.dataset.section=section;if(itemId)b.dataset.itemId=itemId;
    b.textContent=label; const grip=document.createElement("span");grip.className="grip";grip.textContent="\u283f";b.append(grip);
    b.onclick=()=>{selected=type==="section"?{type,section}:{type,section,id:itemId};drawLayers();drawProps();highlight();revealPreviewSelection()};
    b.ondragstart=e=>e.dataTransfer.setData("text/plain",JSON.stringify({type,section,itemId}));b.ondragover=e=>{e.preventDefault();b.classList.add("drop-target")};b.ondragleave=()=>b.classList.remove("drop-target");b.ondrop=e=>{e.preventDefault();b.classList.remove("drop-target");try{move(JSON.parse(e.dataTransfer.getData("text/plain")),{type,section,itemId})}catch(_){}};layers.append(b);
  }
  function drawLayers() {
    layers.replaceChildren();data.sections.forEach(s=>{layer(labels[s],"section",s);const items=["services","digital","custom"].includes(s)?data[s].items:[];items.forEach(x=>layer(x.title||(x.type==="text"?"Teks":"Komponen"),"item",s,x.id))});
    const componentSelection=["services","digital","custom"].includes(selected.section);const customSelection=selected.section==="custom";$("#componentActions").hidden=!componentSelection;$("#addComponentButton").hidden=customSelection;$("#customAddActions").hidden=!customSelection;$("#duplicateButton").disabled=selected.type!=="item";$("#deleteButton").disabled=selected.type!=="item";
  }
  function move(a,b) {if(a.type!==b.type)return;if(a.type==="section"){let from=data.sections.indexOf(a.section),to=data.sections.indexOf(b.section);if(from<0||to<0||from===to)return;data.sections.splice(to,0,data.sections.splice(from,1)[0])}else{if(a.section!==b.section)return;let x=list(a.section),from=x.findIndex(i=>i.id===a.itemId),to=x.findIndex(i=>i.id===b.itemId);if(from<0||to<0||from===to)return;x.splice(to,0,x.splice(from,1)[0])}historyPush();drawAll();status("Urutan komponen berubah; simpan draft untuk menyimpan.")}
  function group(title){let g=document.createElement("section");g.className="property-group";let h=document.createElement("h3");h.textContent=title;g.append(h);props.append(g);return g}
  function field(g,label,value,fn,opt={}){const l=document.createElement("label");l.className=`property-field${opt.type==="range"?" range-field":""}`;const title=document.createElement("span");title.textContent=label;let e;if(opt.options){e=document.createElement("select");opt.options.forEach(([v,n])=>{const o=document.createElement("option");o.value=v;o.textContent=n;e.append(o)});e.value=value}else if(opt.area){e=document.createElement("textarea");e.value=value||""}else{e=document.createElement("input");e.type=opt.type||"text";e.value=value??"";if(["number","range"].includes(opt.type)){e.min=opt.min??0;e.max=opt.max??100;e.step=opt.step||1}}l.append(title,e);if(opt.type==="range"){const output=document.createElement("output");output.textContent=`${value}${opt.unit||""}`;e.addEventListener("input",()=>output.textContent=`${e.value}${opt.unit||""}`);l.append(output)}const update=()=>{fn(["number","range"].includes(opt.type)?Number(e.value):e.value);historyPush();paint();drawLayers();if(opt.refresh)drawProps();status("Ada perubahan desain yang belum disimpan.")};e.addEventListener("input",update);e.addEventListener("change",update);g.append(l);return e}
  function color(g,label,value,fn){const l=document.createElement("label");l.className="property-field color-field";const title=document.createElement("span");title.textContent=label;const row=document.createElement("span");row.className="color-input-row";const picker=document.createElement("input");picker.type="color";picker.value=/^#[0-9a-f]{6}$/i.test(value||"")?value:"#ffffff";const text=document.createElement("input");text.type="text";text.value=value||"";text.placeholder="Transparan / #RRGGBB";const reset=document.createElement("button");reset.type="button";reset.className="clear-color";reset.textContent="Reset";function set(v){fn(v);text.value=v;historyPush();paint();drawLayers();status("Ada perubahan desain yang belum disimpan.")}picker.addEventListener("input",()=>set(picker.value));text.addEventListener("change",()=>{const v=text.value.trim();if(!v||/^#[0-9a-f]{6}$/i.test(v)){picker.value=v||"#ffffff";set(v)}else status("Gunakan kode warna #RRGGBB atau reset untuk transparan.","error")});reset.addEventListener("click",()=>{picker.value="#ffffff";set("")});row.append(picker,text,reset);l.append(title,row);g.append(l)}
  function addPalette(g,label,fn){const box=document.createElement("div");box.className="palette-field";const title=document.createElement("span");title.textContent=label;const chips=document.createElement("div");chips.className="palette-chips";paletteColors.forEach(hex=>{const b=document.createElement("button");b.type="button";b.className="palette-chip";b.style.backgroundColor=hex;b.title=hex;b.setAttribute("aria-label",`Pilih warna ${hex}`);b.onclick=()=>{fn(hex);historyPush();paint();drawLayers();drawProps();status("Palet diterapkan ke desain.")};chips.append(b)});box.append(title,chips);g.append(box)}
  function designControls(item,title){const g=group(title);color(g,"Warna latar",item.background,v=>item.background=v);addPalette(g,"Palet cepat · latar",v=>item.background=v);color(g,"Warna gradient kedua",item.backgroundEnd,v=>item.backgroundEnd=v);field(g,"Sudut gradient",item.gradientAngle,v=>item.gradientAngle=v,{type:"range",min:0,max:360,unit:"°"});field(g,"Transparansi latar",item.backgroundOpacity,v=>item.backgroundOpacity=v,{type:"range",min:0,max:100,unit:"%"});color(g,"Warna teks",item.textColor,v=>item.textColor=v);addPalette(g,"Palet cepat · teks",v=>item.textColor=v);field(g,"Ukuran teks",item.fontSize,v=>item.fontSize=v,{type:"range",min:12,max:48,unit:" px"});field(g,"Perataan teks",item.textAlign,v=>item.textAlign=v,{options:[["left","Kiri"],["center","Tengah"],["right","Kanan"]]});field(g,"Glow",item.glow,v=>item.glow=v,{type:"range",min:0,max:48,unit:" px"});color(g,"Warna glow",item.glowColor,v=>item.glowColor=v);field(g,"Radius sudut",Number.isInteger(item.radius)?item.radius:24,v=>item.radius=v,{type:"range",min:0,max:64,unit:" px"});color(g,"Warna border",item.borderColor,v=>item.borderColor=v);field(g,"Tebal border",item.borderWidth,v=>item.borderWidth=v,{type:"range",min:0,max:8,unit:" px"})}
  function surfaceControls(surface,title){const g=group(title);color(g,"Warna dasar",surface.background,v=>surface.background=v);addPalette(g,"Palet cepat",v=>surface.background=v);color(g,"Gradient kedua",surface.backgroundEnd,v=>surface.backgroundEnd=v);field(g,"Sudut gradient",surface.gradientAngle,v=>surface.gradientAngle=v,{type:"range",min:0,max:360,unit:"°"});field(g,"Transparansi",surface.backgroundOpacity,v=>surface.backgroundOpacity=v,{type:"range",min:0,max:100,unit:"%"});field(g,"Glow",surface.glow,v=>surface.glow=v,{type:"range",min:0,max:48,unit:" px"});color(g,"Warna glow",surface.glowColor,v=>surface.glowColor=v)}
  function drawProps(){
    props.replaceChildren();const s=selected.section;
    if(selected.type==="item"){
      const item=list(s).find(x=>x.id===selected.id);if(!item){selected={type:"section",section:"hero"};drawProps();return}const kind=s==="services"?"Kartu layanan":s==="digital"?"Materi digital":item.type==="text"?"Elemen teks":"Card custom";let g=group(kind);
      if(s==="services"){field(g,"Judul",item.title,v=>item.title=v);field(g,"Deskripsi",item.description,v=>item.description=v,{area:true});field(g,"Ikon",item.icon,v=>item.icon=v,{options:icons});color(g,"Warna kartu (custom)",item.accent,v=>item.accent=v);addPalette(g,"Palet cepat · warna kartu",v=>item.accent=v);color(g,"Warna ikon (custom)",item.iconColor,v=>item.iconColor=v);addPalette(g,"Palet cepat · ikon",v=>item.iconColor=v);color(g,"Warna kotak ikon (custom)",item.iconBg,v=>item.iconBg=v);addPalette(g,"Palet cepat · kotak ikon",v=>item.iconBg=v);field(g,"Link tujuan",item.href,v=>item.href=v)}
      else if(s==="digital"){field(g,"Judul",item.title,v=>item.title=v);field(g,"Path / URL gambar",item.image,v=>item.image=v);field(g,"Teks alt",item.alt,v=>item.alt=v);field(g,"Link tujuan",item.href,v=>item.href=v)}
      else{field(g,"Jenis elemen",item.type,v=>{item.type=v;drawProps()},{options:[["text","Teks"],["card","Card"]]});field(g,"Judul",item.title,v=>item.title=v);field(g,item.type==="text"?"Isi teks":"Deskripsi",item.text,v=>item.text=v,{area:true});if(item.type==="card"){field(g,"Gambar (opsional)",item.image,v=>item.image=v);field(g,"Teks alt",item.alt,v=>item.alt=v);field(g,"Link tujuan (opsional)",item.href,v=>item.href=v)}}
      field(g,"Lebar (jumlah kolom)",item.width,v=>{item.width=v;relayoutSection(s,item)},{type:"range",min:1,max:12});field(g,"Tinggi (jumlah baris)",item.rowSpan||1,v=>{item.rowSpan=v;relayoutSection(s,item)},{type:"range",min:1,max:8});designControls(item,"Warna & efek");return;
    }
    if(s==="hero"){let g=group("Konten hero");field(g,"Label",data.hero.eyebrow,v=>data.hero.eyebrow=v);field(g,"Judul",data.hero.title,v=>data.hero.title=v,{area:true});field(g,"Deskripsi",data.hero.description,v=>data.hero.description=v,{area:true});field(g,"Path gambar",data.hero.image,v=>data.hero.image=v);surfaceControls(data.hero,"Latar & efek hero");g=group("Palet halaman");color(g,"Warna utama",data.theme.primary,v=>data.theme.primary=v);addPalette(g,"Warna brand",v=>data.theme.primary=v);color(g,"Latar halaman",data.theme.background,v=>data.theme.background=v)}
    else if(s==="services"||s==="digital"||s==="custom"){let x=data[s],g=group(s==="custom"?"Konten bebas":"Layout grid");if(s==="custom")field(g,"Judul bagian",x.title,v=>x.title=v);surfaceControls(x,"Latar & efek section");field(g,"Kolom desktop",x.columns,v=>{x.columns=v;if(hasLayout(s))resolveLayout(list(s),v,null)},{type:"range",min:1,max:12});field(g,"Jarak antar elemen",x.gap,v=>x.gap=v,{type:"range",min:0,max:48,unit:" px"});let n=document.createElement("p");n.className="property-note";n.textContent=s==="custom"?"Tambahkan teks atau card dari panel Layers. Semua elemen dapat diberi gradient, transparansi, glow, radius, dan border. Tarik card di kanvas untuk memindahkan posisinya di grid.":"Pilih card pada Layers atau di kanvas untuk mengedit konten dan gaya. Tarik card di kanvas untuk memindahkan posisinya di grid.";g.append(n);resetGridButton(g,s)}
    else if(s==="contact"){let x=data.contact,g=group("Informasi kontak");[["Nomor telepon","phone"],["Nomor WhatsApp","whatsapp"],["Email","email"],["Alamat","address"],["Hari buka","weekday"],["Jam buka","weekdayHours"],["Hari libur","sunday"],["Status libur","sundayStatus"]].forEach(([n,k])=>field(g,n,x[k],v=>x[k]=v))}
    else{let g=group("Galeri");let n=document.createElement("p");n.className="property-note";n.textContent="Carousel tetap dikelola lewat Admin Galeri agar upload dan kontraknya tetap terjaga.";g.append(n)}
  }  function drawAll(){drawLayers();drawProps();paint();$("#undoButton").disabled=hi<=0;$("#redoButton").disabled=hi>=history.length-1}
  function newId(prefix){return `${prefix}-${crypto.randomUUID().replace(/-/g,"").slice(0,12)}`}
  function addComponent(){let s=selected.section;if(s==="custom"){addCustom("card");return}let x=list(s),item=s==="services"?{id:newId("service"),title:"Layanan baru",description:"Deskripsi layanan",href:"https://example.com",icon:"file",color:"blue",width:1,background:"",textColor:"",fontSize:16}:{id:newId("material"),title:"Materi baru",href:"https://example.com",image:"assets/map.svg",alt:"",width:1,background:"",textColor:"",fontSize:16};Object.assign(item,{col:0,row:0,rowSpan:1,iconColor:"",iconBg:"",accent:"",backgroundEnd:"",gradientAngle:135,backgroundOpacity:100,glow:0,glowColor:"",radius:"",borderColor:"",borderWidth:0,textAlign:"left"});x.push(item);selected={type:"item",section:s,id:item.id};historyPush();drawAll();revealPreviewSelection();status("Card ditambahkan.")}
  function addCustom(type){const item={id:newId("custom"),col:0,row:0,rowSpan:1,type,title:type==="text"?"Teks baru":"Card baru",text:type==="text"?"Tulis teks di sini.":"Deskripsi card baru.",href:"",image:"",alt:"",width:1,background:type==="text"?"":"#ffffff",backgroundEnd:"",gradientAngle:135,backgroundOpacity:100,textColor:"#163b52",fontSize:18,glow:0,glowColor:"#0b6c83",radius:type==="text"?0:24,borderColor:"",borderWidth:0,textAlign:"left"};data.custom.items.push(item);selected={type:"item",section:"custom",id:item.id};historyPush();drawAll();revealPreviewSelection();status(type==="text"?"Elemen teks ditambahkan.":"Card ditambahkan.")}
  function duplicate(){let x=list(selected.section),i=x.findIndex(y=>y.id===selected.id);if(i<0)return;let item=copy(x[i]);item.col=0;item.row=0;item.id=newId(selected.section==="services"?"service":selected.section==="digital"?"material":"custom");x.splice(i+1,0,item);selected.id=item.id;historyPush();drawAll();revealPreviewSelection();status("Komponen diduplikasi.")}
  function remove(){let x=list(selected.section),i=x.findIndex(y=>y.id===selected.id);if(i<0)return;let s=selected.section;x.splice(i,1);selected={type:"section",section:s};historyPush();drawAll();status("Komponen dihapus.")}
  /* ===== Canvas grid: drag card, ubah ukuran, pindah section ===== */
  let gridOn=true,drag=null,suppressClick=false;
  const GRID_SECTIONS=["services","digital","custom"];
  const ITEM_SEL=".service-card,.digital-card,.custom-block";
  const PHANTOM_ROW=90;
  function pdoc(){try{return preview.contentDocument}catch(_){return null}}
  function gridContainerOf(section){const doc=pdoc();if(!doc)return null;const s=doc.querySelector(`[data-editor-section="${section}"]`);if(!s)return null;return section==="services"?s:section==="digital"?s.querySelector(".digital-grid"):section==="custom"?s.querySelector(".custom-content-grid"):null}
  function measureGrid(c){
    const cs=c.ownerDocument.defaultView.getComputedStyle(c),r=c.getBoundingClientRect(),n=v=>parseFloat(v)||0;
    const sizes=v=>v&&v!=="none"?v.split(/\s+/).map(parseFloat).filter(x=>!isNaN(x)):[];
    const gx=n(cs.columnGap),gy=n(cs.rowGap);
    let x=r.left+n(cs.borderLeftWidth)+n(cs.paddingLeft),y=r.top+n(cs.borderTopWidth)+n(cs.paddingTop);
    const colLines=sizes(cs.gridTemplateColumns).map(w=>{const o={start:x,size:w};x+=w+gx;return o});
    const rowLines=sizes(cs.gridTemplateRows).map(h=>{const o={start:y,size:h};y+=h+gy;return o});
    return {colLines,rowLines,gx,gy,endY:y};
  }
  function rowAt(g,i){if(i<=g.rowLines.length)return g.rowLines[i-1];const last=g.rowLines[g.rowLines.length-1];const base=last?last.start+last.size+g.gy:g.endY;return {start:base+(i-g.rowLines.length-1)*(PHANTOM_ROW+g.gy),size:PHANTOM_ROW}}
  function nearest(starts,v){let b=0,d=1e9;starts.forEach((s,i)=>{const k=Math.abs(s-v);if(k<d){d=k;b=i}});return b+1}
  function hasLayout(section){return list(section).some(i=>i.col>0&&i.row>0)}
  function normalizeGrid(section){
    const items=list(section);
    if(hasLayout(section))return true;
    const c=gridContainerOf(section);if(!c||!items.length)return false;
    const g=measureGrid(c),cols=g.colLines.length;if(!cols)return false;
    const cs=g.colLines.map(l=>l.start),rs=g.rowLines.map(l=>l.start);
    items.forEach(it=>{const el=c.querySelector(`[data-editor-id="${it.id}"]`);if(!el){it.col=0;it.row=0;return}const r=el.getBoundingClientRect();it.col=nearest(cs,r.left);it.row=nearest(rs,r.top);it.rowSpan=Math.max(1,it.rowSpan||1);it.width=Math.max(1,Math.min(it.width||1,cols))});
    data[section].columns=Math.max(1,Math.min(cols,12));
    paint();
    return true;
  }
  function resolveLayout(items,cols,fixedId){
    const hit=(a,b)=>a.col<b.col+b.w&&b.col<a.col+a.w&&a.row<b.row+b.h&&b.row<a.row+a.h;
    const pos=items.filter(i=>i.col>0&&i.row>0);
    const fixed=pos.find(i=>i.id===fixedId);
    const order=(fixed?[fixed]:[]).concat(pos.filter(i=>i!==fixed).sort((a,b)=>a.row-b.row||a.col-b.col));
    const placed=[];
    order.forEach(it=>{const w=Math.max(1,Math.min(it.width||1,cols)),h=Math.max(1,it.rowSpan||1);const c=Math.max(1,Math.min(it.col,cols-w+1));let r=Math.max(1,it.row);while(placed.some(p=>hit({col:c,row:r,w,h},p)))r++;it.col=c;it.row=r;placed.push({col:c,row:r,w,h})});
    const used=new Set();placed.forEach(p=>{for(let k=0;k<p.h;k++)used.add(p.row+k)});
    const map={};[...used].sort((a,b)=>a-b).forEach((r,i)=>map[r]=i+1);
    order.forEach(it=>{it.row=Math.min(map[it.row],60)});
  }
  function relayoutSection(section,item){
    if(!hasLayout(section))return;
    const c=gridContainerOf(section);if(!c||c.dataset.explicitLayout!=="1")return;
    resolveLayout(list(section),Number(c.dataset.editorColumns)||data[section].columns||1,item&&item.id);
  }
  function resetGridButton(g,section){const b=document.createElement("button");b.type="button";b.className="quiet-button";b.textContent="Reset susunan grid (otomatis)";b.style.marginTop="8px";b.addEventListener("click",()=>{list(section).forEach(i=>{i.col=0;i.row=0;i.rowSpan=1});historyPush();drawAll();status("Susunan grid dikembalikan ke otomatis.")});g.append(b)}
  function injectDragStyle(doc){
    if(!doc.head||doc.getElementById("se-drag-style"))return;
    const st=doc.createElement("style");st.id="se-drag-style";
    st.textContent=".service-card,.digital-card,.custom-block{cursor:grab;-webkit-user-drag:none;user-select:none}"+
      ".service-card *,.digital-card *,.custom-block *{-webkit-user-drag:none}"+
      ".se-dragging{position:relative;z-index:2147482000!important;opacity:.92;transition:none!important;box-shadow:0 24px 50px rgba(0,52,98,.35)!important;cursor:grabbing!important}"+
      "#se-overlay{position:absolute;left:0;top:0;width:0;height:0;z-index:2147483000;pointer-events:none}"+
      "#se-overlay .se-cell{position:absolute;box-sizing:border-box;border:1px dashed rgba(0,52,98,.45);background:rgba(0,52,98,.04);border-radius:6px}"+
      "#se-overlay .se-phantom{border-color:rgba(0,52,98,.28);background:transparent}"+
      "#se-overlay .se-target{position:absolute;box-sizing:border-box;border:2px solid #003462;background:rgba(0,52,98,.16);border-radius:10px}"+
      "#se-overlay .se-handle{position:absolute;pointer-events:auto;box-sizing:border-box}"+
      "#se-overlay .se-resize{width:22px;height:22px;border-radius:6px;background:#003462;border:2px solid #fff;cursor:nwse-resize;box-shadow:0 4px 10px rgba(0,0,0,.3)}"+
      "#se-overlay .se-pill{padding:6px 11px;border-radius:8px;background:#003462;color:#fff;font:700 12px/1 system-ui,sans-serif;cursor:grab;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.28);user-select:none}"+
      "#se-overlay .se-line{position:absolute;height:5px;border-radius:5px;background:#003462;box-shadow:0 0 0 3px rgba(0,52,98,.25)}";
    doc.head.append(st);
  }
  function mk(root,cls,x,y,w,h,txt){const d=root.ownerDocument.createElement("div");d.className=cls;d.style.left=x+"px";d.style.top=y+"px";if(w!=null){d.style.width=w+"px";d.style.height=h+"px"}if(txt)d.textContent=txt;root.append(d);return d}
  function drawOverlay(extra){
    const doc=pdoc();if(!doc||!doc.body||!data)return;
    const dragging=!!(drag&&drag.started);
    if(extra===undefined&&dragging)extra=drag.extra;
    if(dragging&&extra!==undefined)drag.extra=extra;
    injectDragStyle(doc);
    let root=doc.getElementById("se-overlay");if(!root){root=doc.createElement("div");root.id="se-overlay";doc.body.append(root)}
    root.replaceChildren();
    const win=doc.defaultView,sx=win.scrollX,sy=win.scrollY;
    const gsec=dragging&&drag.mode!=="section"?drag.section:selected.section;
    const c=GRID_SECTIONS.includes(gsec)&&!(dragging&&drag.mode==="section")?gridContainerOf(gsec):null;
    let g=null;
    if(c&&(gridOn||dragging)){
      g=dragging&&drag.grid?drag.grid:measureGrid(c);
      const nr=g.rowLines.length+(dragging?1:0);
      for(let r=1;r<=nr;r++){const row=rowAt(g,r);g.colLines.forEach(col=>mk(root,"se-cell"+(r>g.rowLines.length?" se-phantom":""),col.start+sx,row.start+sy,col.size,row.size))}
    }
    if(extra&&extra.target&&g){const t=extra.target,c1=g.colLines[t.col-1],c2=g.colLines[Math.min(t.col+t.w-2,g.colLines.length-1)],r1=rowAt(g,t.row),r2=rowAt(g,t.row+t.h-1);if(c1&&c2&&r1&&r2)mk(root,"se-target",c1.start+sx,r1.start+sy,c2.start+c2.size-c1.start,r2.start+r2.size-r1.start)}
    if(extra&&extra.line){const l=mk(root,"se-line",extra.line.x+sx,extra.line.y+sy-3);l.style.width=extra.line.w+"px"}
    if(!dragging){
      if(selected.type==="item"&&GRID_SECTIONS.includes(selected.section)){const cc=gridContainerOf(selected.section),el=cc&&cc.querySelector(`[data-editor-id="${selected.id}"]`);if(el){const r=el.getBoundingClientRect(),h=mk(root,"se-handle se-resize",r.right-14+sx,r.bottom-14+sy,22,22);h.dataset.seHandle="resize";h.title="Tarik untuk mengubah ukuran"}}
      const sec=doc.querySelector(`[data-editor-section="${selected.section}"]`);
      if(sec&&!sec.hidden){const r=sec.getBoundingClientRect();if(r.height>0){const top=selected.section==="hero"?r.top+88:(r.top-28<4?r.top+6:r.top-28);const h=mk(root,"se-handle se-pill",r.left+14+sx,top+sy,null,null,"⠿ "+(labels[selected.section]||selected.section)+" · tarik untuk memindahkan");h.dataset.seHandle="section"}}
    }
  }
  function bindDragInteractions(doc){
    injectDragStyle(doc);
    doc.addEventListener("dragstart",e=>e.preventDefault(),true);
    doc.addEventListener("pointerdown",onDragDown,true);
    doc.addEventListener("click",e=>{if(suppressClick){suppressClick=false;e.preventDefault();e.stopImmediatePropagation()}},true);
    doc.addEventListener("keydown",e=>{if(e.key==="Escape"&&drag)endDrag()},true);
    try{doc.defaultView.addEventListener("resize",()=>drawOverlay())}catch(_){}
  }
  function onDragDown(e){
    if(e.button!==0||!data||drag)return;
    const t=e.target;if(!t||!t.closest)return;
    const h=t.closest("[data-se-handle]");let d=null;
    if(h){const k=h.dataset.seHandle;if(k==="resize"&&selected.type==="item")d={mode:"resize",section:selected.section,id:selected.id};else if(k==="section")d={mode:"section",section:selected.section}}
    else{const card=t.closest(ITEM_SEL),sec=card&&card.closest("[data-editor-section]");if(card&&sec&&GRID_SECTIONS.includes(sec.dataset.editorSection))d={mode:"move",section:sec.dataset.editorSection,id:card.dataset.editorId}}
    if(!d)return;
    const fr=preview.getBoundingClientRect();
    Object.assign(d,{started:false,sx:e.clientX,sy:e.clientY,cx:e.clientX,cy:e.clientY,px:fr.left+e.clientX,py:fr.top+e.clientY,pid:e.pointerId});
    drag=d;const doc=pdoc();
    doc.addEventListener("pointermove",onDragMove,true);doc.addEventListener("pointerup",onDragUp,true);doc.addEventListener("pointercancel",endDrag,true);
    e.preventDefault();
  }
  function onDragMove(e){
    if(!drag||e.pointerId!==drag.pid)return;
    const fr=preview.getBoundingClientRect();
    drag.cx=e.clientX;drag.cy=e.clientY;drag.px=fr.left+e.clientX;drag.py=fr.top+e.clientY;
    if(!drag.started){if(Math.hypot(drag.cx-drag.sx,drag.cy-drag.sy)<6)return;if(!startDrag())return}
    updateDrag();
  }
  function startDrag(){
    const doc=pdoc();
    if(drag.mode==="section"){
      drag.secs=data.sections.map(id=>({id,el:doc.querySelector(`[data-editor-section="${id}"]`)})).filter(s=>s.el&&!s.el.hidden&&s.el.getBoundingClientRect().height>0);
      selected={type:"section",section:drag.section};
    }else{
      if(preview.clientWidth<=760){status("Tampilan mobile mengikuti urutan otomatis. Pilih Desktop atau Tablet untuk mengatur grid.","error");endDrag();return false}
      const c0=gridContainerOf(drag.section);
      if(hasLayout(drag.section)&&c0&&c0.dataset.explicitLayout!=="1"){status(`Kanvas terlalu sempit untuk ${data[drag.section].columns} kolom. Perlebar kanvas (Desktop) lalu coba lagi.`,"error");endDrag();return false}
      if(!normalizeGrid(drag.section)){endDrag();return false}
      const c=gridContainerOf(drag.section),el=c&&c.querySelector(`[data-editor-id="${drag.id}"]`),item=list(drag.section).find(x=>x.id===drag.id);
      if(!el||!item){endDrag();return false}
      if(drag.mode==="move"){el.classList.add("se-dragging");el.style.transform="translate(0px, 0px)"}
      drag.c=c;drag.el=el;drag.item=item;drag.startRect=el.getBoundingClientRect();drag.grid=measureGrid(c);drag.cols=drag.grid.colLines.length;
      drag.w=Math.max(1,Math.min(item.width||1,drag.cols));drag.h=Math.max(1,item.rowSpan||1);
      selected={type:"item",section:drag.section,id:drag.id};
    }
    drag.started=true;
    drawLayers();drawProps();
    try{doc.documentElement.setPointerCapture(drag.pid)}catch(_){}
    drag.raf=requestAnimationFrame(dragTick);
    return true;
  }
  function updateDrag(){
    if(!drag||!drag.started)return;
    if(drag.mode==="section"){
      const secs=drag.secs;let idx=secs.length;
      for(let i=0;i<secs.length;i++){const r=secs[i].el.getBoundingClientRect();if(drag.cy<r.top+r.height/2){idx=i;break}}
      drag.insertIdx=idx;
      const ref=(idx<secs.length?secs[idx]:secs[secs.length-1]).el.getBoundingClientRect();
      drawOverlay({line:{x:ref.left,y:idx<secs.length?ref.top:ref.bottom,w:ref.width}});return;
    }
    const g=drag.grid,cols=drag.cols;
    if(drag.mode==="move"){
      const dx=drag.cx-drag.sx,dy=drag.cy-drag.sy;
      drag.el.style.transform=`translate(${dx}px, ${dy}px)`;
      const cs=g.colLines.map(l=>l.start),rs=g.rowLines.map(l=>l.start);rs.push(rowAt(g,g.rowLines.length+1).start);
      const col=Math.max(1,Math.min(nearest(cs,drag.startRect.left+dx),cols-drag.w+1));
      drag.target={col,row:nearest(rs,drag.startRect.top+dy),w:drag.w,h:drag.h};
    }else{
      const it=drag.item;let endC=it.col,endR=it.row;
      g.colLines.forEach((l,i)=>{if(i+1>=it.col&&l.start+l.size/2<=drag.cx)endC=i+1});
      g.rowLines.forEach((l,i)=>{if(i+1>=it.row&&l.start+l.size/2<=drag.cy)endR=i+1});
      drag.target={col:it.col,row:it.row,w:Math.min(endC-it.col+1,12),h:Math.min(endR-it.row+1,8)};
    }
    drawOverlay({target:drag.target});
  }
  function dragTick(){
    if(!drag||!drag.started)return;
    if(canvasStage){
      const r=canvasStage.getBoundingClientRect(),z=56;let dy=0;
      if(drag.py<r.top+z)dy=-Math.min(24,Math.ceil((r.top+z-drag.py)/3));else if(drag.py>r.bottom-z)dy=Math.min(24,Math.ceil((drag.py-(r.bottom-z))/3));
      if(dy){const before=canvasStage.scrollTop;canvasStage.scrollTop+=dy;if(canvasStage.scrollTop!==before){const fr=preview.getBoundingClientRect();drag.cx=drag.px-fr.left;drag.cy=drag.py-fr.top;updateDrag()}}
    }
    drag.raf=requestAnimationFrame(dragTick);
  }
  function onDragUp(e){
    if(!drag||e.pointerId!==drag.pid)return;
    const d=drag;
    if(d.started){suppressClick=true;setTimeout(()=>{suppressClick=false},80)}
    endDrag();
    if(d.started)applyDrop(d);
  }
  function endDrag(){
    const d=drag;if(!d)return;
    const doc=pdoc();
    if(doc){doc.removeEventListener("pointermove",onDragMove,true);doc.removeEventListener("pointerup",onDragUp,true);doc.removeEventListener("pointercancel",endDrag,true);try{doc.documentElement.releasePointerCapture(d.pid)}catch(_){}}
    if(d.raf)cancelAnimationFrame(d.raf);
    if(d.el){d.el.classList.remove("se-dragging");d.el.style.transform=""}
    drag=null;drawOverlay();
  }
  function applyDrop(d){
    if(d.mode==="section"){
      const id=d.section,secs=d.secs;if(d.insertIdx===undefined)return;
      const others=secs.filter(s=>s.id!==id);if(!others.length)return;
      const pos=secs.slice(0,d.insertIdx).filter(s=>s.id!==id).length;
      const arr=data.sections.filter(s=>s!==id);
      arr.splice(pos<others.length?arr.indexOf(others[pos].id):arr.indexOf(others[others.length-1].id)+1,0,id);
      if(arr.join()===data.sections.join())return;
      data.sections=arr;historyPush();drawAll();status(`Section ${labels[id]||id} dipindahkan; simpan draft untuk menyimpan.`);return;
    }
    const t=d.target,it=d.item;
    if(t){if(d.mode==="move"){it.col=t.col;it.row=t.row}else{it.width=t.w;it.rowSpan=t.h}resolveLayout(list(d.section),d.cols,it.id)}
    historyPush();drawAll();status(d.mode==="move"?"Posisi card diperbarui; simpan draft untuk menyimpan.":"Ukuran card diperbarui; simpan draft untuk menyimpan.");
  }
  (function initGridUi(){
    const bar=document.querySelector(".canvas-toolbar");
    if(bar&&!document.getElementById("gridToggle")){const b=document.createElement("button");b.type="button";b.id="gridToggle";b.className="quiet-button";b.setAttribute("aria-pressed","true");b.textContent="Grid: aktif";b.style.margin="0 10px";b.style.whiteSpace="nowrap";b.addEventListener("click",()=>{gridOn=!gridOn;b.textContent=gridOn?"Grid: aktif":"Grid: mati";b.setAttribute("aria-pressed",String(gridOn));drawOverlay()});bar.insertBefore(b,bar.querySelector(".device-switch"))}
    const hint=document.querySelector(".canvas-hint");if(hint)hint.textContent="Tarik card untuk memindahkan di grid · tarik kotak biru di pojok card untuk mengubah ukuran · tarik label section untuk memindahkan section.";
  })();
  let previewInteractionsBound=false;
  function bindPreviewInteractions(){if(previewInteractionsBound)return;try{const doc=preview.contentDocument;if(!doc)return;bindDragInteractions(doc);doc.addEventListener("click",e=>{e.preventDefault();let sec=e.target.closest("[data-editor-section]");if(!sec)return;let c=e.target.closest(".service-card,.digital-card,.custom-block");selected=c?{type:"item",section:sec.dataset.editorSection,id:c.dataset.editorId}:{type:"section",section:sec.dataset.editorSection};drawLayers();drawProps();highlight()},true);previewInteractionsBound=true}catch(_){status("Canvas pratinjau tidak dapat diakses.","error")}}
  function frameReady(){preview.dataset.ready="yes";bindPreviewInteractions();paint();syncPreviewScroll()}
  function previewMessage(event){if(event.origin!==location.origin||event.source!==preview.contentWindow||!event.data)return;if(event.data.type==="site-editor-preview-ready")frameReady();else if(event.data.type==="site-editor-preview-applied"){resizePreviewToContent();updatePreviewRenderStatus();drawOverlay()}else if(event.data.type==="site-editor-preview-height"){const height=Number(event.data.height);if(Number.isFinite(height)){preview.style.height=`${Math.max(500,Math.min(height,12000))}px`;drawOverlay()}}else if(event.data.type==="site-editor-preview-error"){updatePreviewRenderStatus(`Render gagal: ${event.data.message||"kesalahan render"}`);status(`Pratinjau gagal: ${event.data.message||"kesalahan render"}`,"error")}}
  function requestPreviewReady(){try{preview.contentWindow.postMessage({type:"site-editor-preview-init"},location.origin)}catch(_){}}
  async function login(e){e.preventDefault();let b=$("#loginButton");b.disabled=true;$("#loginStatus").textContent="Memeriksa login\u2026";try{let result=await req(`${G}&action=login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:$("#adminId").value,password:$("#adminPassword").value})});session=result.session;$("#adminPassword").value="";let defaults=await req("./site-content-defaults.json?v=visual-1");let state=await req(`${E}&action=draft`,{headers:headers()});data=normalizeContent(state.draft?.content||state.published?.content||defaults,defaults);if(!state.draft&&!state.published)await req(`${E}&action=baseline`,{method:"POST",headers:headers(),body:JSON.stringify({content:data})});history=[JSON.stringify(data)];hi=0;$("#loginScreen").hidden=true;$("#editorApp").hidden=false;drawAll();$("#loginStatus").textContent=""}catch(err){$("#loginStatus").textContent=editorError(err);$("#loginStatus").className="status error"}finally{b.disabled=false}}
  async function saveDraft(){if(busy)return;busy=true;status("Menyimpan draft\u2026");try{await req(`${E}&action=draft`,{method:"POST",headers:headers(),body:JSON.stringify({content:data})});status("Draft tersimpan di Cloudflare KV.","success")}catch(err){status(editorError(err),"error");if(err.message.includes("Sesi"))logout(false)}finally{busy=false}}
  async function publish(){if(busy||!confirm("Terbitkan perubahan ke website publik? Versi terbit sebelumnya masuk riwayat."))return;busy=true;status("Menyimpan draft lalu menerbitkan\u2026");try{await req(`${E}&action=draft`,{method:"POST",headers:headers(),body:JSON.stringify({content:data})});let r=await req(`${E}&action=publish`,{method:"POST",headers:headers(),body:"{}"});history=[JSON.stringify(data)];hi=0;drawAll();status(`Berhasil diterbitkan \u00b7 ${r.version.slice(0,8)}.`,"success")}catch(err){status(editorError(err),"error")}finally{busy=false}}
  async function versions(){try{let r=await req(`${E}&action=versions`,{headers:headers()});let s=$("#versionSelect");s.replaceChildren();(r.versions||[]).forEach(v=>{let o=document.createElement("option");o.value=v.id;o.textContent=`${new Date(v.createdAt).toLocaleString("id-ID")} \u00b7 ${v.id.slice(0,8)}`;s.append(o)});if(!s.options.length){status("Belum ada riwayat versi.");return}$("#versionsDialog").showModal()}catch(err){status(editorError(err),"error")}}
  async function rollback(){let versionId=$("#versionSelect").value;if(!versionId||busy||!confirm("Pulihkan versi terpilih sebagai versi publik baru?"))return;busy=true;try{let r=await req(`${E}&action=rollback`,{method:"POST",headers:headers(),body:JSON.stringify({versionId})});$("#versionsDialog").close();status(`Publik dipulihkan \u00b7 ${r.version.slice(0,8)}. Draft aktif tetap tersimpan terpisah.`,"success")}catch(err){status(editorError(err),"error")}finally{busy=false}}
  async function logout(revoke=true){if(revoke&&session)try{await req(`${E}&action=logout`,{method:"POST",headers:headers(),body:"{}"})}catch(_){}session="";data=null;$("#editorApp").hidden=true;$("#loginScreen").hidden=false;$("#loginStatus").textContent="Anda sudah keluar."}
  function device(name){document.querySelectorAll("[data-device]").forEach(b=>b.classList.toggle("active",b.dataset.device===name));preview.style.width=name==="mobile"?"390px":name==="tablet"?"768px":"100%";preview.style.maxWidth="100%";requestAnimationFrame(()=>{resizePreviewToContent();syncPreviewScroll()})}
  function undo(n){let k=hi+n;if(k<0||k>=history.length)return;hi=k;data=JSON.parse(history[hi]);drawAll();status("Riwayat edit dipulihkan.")}
  $("#loginForm").addEventListener("submit",login);$("#addComponentButton").addEventListener("click",addComponent);$("#addTextButton").addEventListener("click",()=>addCustom("text"));$("#addCardButton").addEventListener("click",()=>addCustom("card"));$("#duplicateButton").addEventListener("click",duplicate);$("#deleteButton").addEventListener("click",remove);$("#undoButton").addEventListener("click",()=>undo(-1));$("#redoButton").addEventListener("click",()=>undo(1));$("#saveDraftButton").addEventListener("click",saveDraft);$("#publishButton").addEventListener("click",publish);$("#versionsButton").addEventListener("click",versions);$("#rollbackButton").addEventListener("click",rollback);$("#logoutButton").addEventListener("click",()=>logout());preview.addEventListener("load",frameReady);window.addEventListener("message",previewMessage);if(canvasStage)canvasStage.addEventListener("scroll",syncPreviewScroll,{passive:true});setTimeout(requestPreviewReady,0);document.querySelectorAll("[data-device]").forEach(b=>b.addEventListener("click",()=>device(b.dataset.device)));
  document.addEventListener("keydown",e=>{if(!(e.ctrlKey||e.metaKey))return;let k=e.key.toLowerCase();if(k==="z"&&!e.shiftKey){e.preventDefault();undo(-1)}else if(k==="y"||(k==="z"&&e.shiftKey)){e.preventDefault();undo(1)}else if(k==="s"){e.preventDefault();saveDraft()}});
}
