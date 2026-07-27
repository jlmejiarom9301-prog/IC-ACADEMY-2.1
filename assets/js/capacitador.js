(function () {
  "use strict";

  var state = { token: "", data: null, topics: [], currentId: null, status: "No iniciada", navOpen: true, currentVideo: null };
  var el = {};
  var fixed = [
    { id: "registro", kind: "registro", section: "Operación", title: "Registro" },
    { id: "evaluacion", kind: "evaluacion", section: "Operación", title: "Evaluación" },
    { id: "cierre", kind: "cierre", section: "Cierre", title: "Cierre" }
  ];

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cache();
    bind();
    state.token = (new URLSearchParams(location.search).get("session") || "").trim();
    if (!state.token) return showError("Acceso incompleto", "La liga no contiene el token de presentación de la sesión.");
    load();
  }

  function cache() {
    ["state-loading","state-error","error-title","error-message","presentation","tb-course","tb-trainer","tb-folio","tb-topic-indicator","progress-text","progress-bar","btn-exit-fullscreen","btn-nav-toggle","btn-nav-close","cap-nav","nav-list","cap-main","screen-inicio","screen-tema","screen-registro","screen-evaluacion","screen-cierre","start-course","start-trainer","start-date","start-location","start-duration","btn-start","btn-show-qr-from-start","topic-stage","topic-context-actions","registro-status","registro-folio","registro-course","attendee-total","attendee-capacity","attendee-updated","btn-refresh-count","qr-registro-box","qr-registro-img","qr-registro-placeholder","eval-qr-box","eval-qr-img","eval-unavailable","eval-time","eval-min-score","eval-max-attempts","btn-show-eval-from-close","btn-end-presentation","cierre-contacto","cap-control-panel","video-modal","video-modal-title","video-modal-frame","btn-restart-video"].forEach(function(id){ el[id.replace(/-([a-z])/g,function(_,c){return c.toUpperCase();})]=document.getElementById(id); });
  }

  function bind() {
    el.btnStart.addEventListener("click", function(){ setStatus("En presentación"); firstContent(); });
    el.btnShowQrFromStart.addEventListener("click", function(){ go("registro"); });
    el.btnRefreshCount.addEventListener("click", refreshCount);
    el.btnShowEvalFromClose.addEventListener("click", function(){ go("evaluacion"); });
    el.btnEndPresentation.addEventListener("click", function(){ setStatus("Finalizada"); toast("Presentación finalizada"); });
    el.btnNavToggle.addEventListener("click", toggleNav);
    el.btnNavClose.addEventListener("click", toggleNav);
    el.btnExitFullscreen.addEventListener("click", exitFullscreen);
    el.capControlPanel.addEventListener("click", function(e){ var b=e.target.closest("[data-action]"); if(b) action(b.dataset.action); });
    document.addEventListener("click", function(e){
      var jump=e.target.closest("[data-jump]"); if(jump) go(jump.dataset.jump);
      if(e.target.closest("[data-close-video]")) closeVideo();
      var open=e.target.closest("[data-open-video]"); if(open) openVideo(open.dataset.openVideo);
    });
    el.btnRestartVideo.addEventListener("click", restartVideo);
    document.addEventListener("keydown", keys);
    document.addEventListener("fullscreenchange", fullscreenUi);
  }

  function load() {
    ICAC_API.getPresentation(state.token).then(function(resp){
      if(!resp || !resp.success) return loadError(resp || {});
      state.data=resp.data || {};
      var contents=(state.data.contents || []).slice().sort(function(a,b){return (+a.order||0)-(+b.order||0);});
      if(!contents.length) return showError("Curso sin contenidos", "No hay contenidos activos configurados para esta capacitación.");
      state.topics=contents.map(normalize).concat(fixed);
      state.status=(state.data.session && state.data.session.presentationStatus)||"No iniciada";
      el.stateLoading.hidden=true; el.presentation.hidden=false;
      renderTop(); renderNav(); renderStart();
      var saved=state.data.session && state.data.session.currentTopic;
      go(saved && find(saved) ? saved : null, false);
    }).catch(function(){ showError("Error de conexión", "No fue posible consultar la presentación. Verifica la conexión y que el workflow esté activo."); });
  }

  function normalize(c){
    return {
      id:c.contentId, kind:"contenido", order:+c.order||0, section:c.section||"Contenido", type:c.type||"Texto",
      title:c.title||"Contenido", subtitle:c.subtitle||"", keyMessage:c.keyMessage||"", description:c.description||"",
      supportText:c.supportText||"", embedUrl:c.embedUrl||"", duration:c.duration||"", contactEmail:c.contactEmail||"", contactPhone:c.contactPhone||""
    };
  }

  function loadError(r){
    var m={INVALID_TOKEN:["Token inválido","La liga de presentación no tiene un formato válido."],TOKEN_INVALID:["Sesión no encontrada","No existe una presentación asociada a este acceso."],PRESENTATION_DISABLED:["Presentación deshabilitada","Habilita el acceso de presentación desde Airtable."],SESSION_CANCELLED:["Sesión cancelada","Esta sesión fue cancelada."],COURSE_WITHOUT_CONTENT:["Curso sin contenidos","No hay contenidos activos para esta sesión."]};
    var x=m[r.code]||["No se pudo cargar","El backend devolvió un error. Revisa el workflow de consulta de presentación."];
    showError(x[0],x[1]);
  }

  function showError(t,m){ el.stateLoading.hidden=true; el.presentation.hidden=true; el.stateError.hidden=false; el.errorTitle.textContent=t; el.errorMessage.textContent=m; }

  function renderTop(){
    var s=state.data.session||{}, c=state.data.course||{}, tr=state.data.trainer||{};
    el.tbCourse.textContent=c.name||"Capacitación";
    el.tbTrainer.textContent=tr.name||s.trainer||"";
    el.tbFolio.textContent=s.folio||"";
  }

  function renderStart(){
    var s=state.data.session||{}, c=state.data.course||{}, tr=state.data.trainer||{};
    el.startCourse.textContent=c.name||"Código de Ética y Compliance";
    el.startTrainer.textContent=tr.name||s.trainer||"Por confirmar";
    el.startDate.textContent=formatDate(s.startDate||s.start);
    el.startLocation.textContent=s.location||s.modality||"Por confirmar";
    el.startDuration.textContent=c.duration||s.duration||"Según agenda";
  }

  function renderNav(){
    el.navList.innerHTML="";
    var groups={};
    state.topics.forEach(function(t){ (groups[t.section]||(groups[t.section]=[])).push(t); });
    Object.keys(groups).forEach(function(section,gi){
      var wrap=document.createElement("section"); wrap.className="cap-nav-group";
      var h=document.createElement("button"); h.type="button"; h.className="cap-nav-group__title"; h.innerHTML="<span>"+esc(section)+"</span><span>⌄</span>";
      var list=document.createElement("div"); list.className="cap-nav-group__items";
      groups[section].forEach(function(t){
        var b=document.createElement("button"); b.type="button"; b.className="cap-nav-item"; b.dataset.topic=t.id;
        b.innerHTML='<span class="cap-nav-item__dot"></span><span>'+esc(t.title)+'</span>';
        b.addEventListener("click",function(){go(t.id); if(innerWidth<1000) toggleNav(false);});
        list.appendChild(b);
      });
      h.addEventListener("click",function(){ wrap.classList.toggle("is-collapsed"); });
      wrap.appendChild(h); wrap.appendChild(list); el.navList.appendChild(wrap);
    });
  }

  function go(id,persist){
    state.currentId=id||null;
    [el.screenInicio,el.screenTema,el.screenRegistro,el.screenEvaluacion,el.screenCierre].forEach(function(x){x.hidden=true;});
    if(!id){ renderStart(); el.screenInicio.hidden=false; el.tbTopicIndicator.textContent="Inicio"; }
    else {
      var t=find(id); if(!t) return;
      el.tbTopicIndicator.textContent=t.title;
      if(t.kind==="contenido"){ renderTopic(t); el.screenTema.hidden=false; }
      if(t.kind==="registro"){ renderRegistro(); el.screenRegistro.hidden=false; }
      if(t.kind==="evaluacion"){ renderEvaluacion(); el.screenEvaluacion.hidden=false; }
      if(t.kind==="cierre"){ el.screenCierre.hidden=false; }
    }
    updateNav(); updateProgress(); animateScreen();
    if(persist!==false) persistState(id,state.status);
  }

  function renderTopic(t){
    var type=(t.type||"").toLowerCase(), title=(t.title||"").toLowerCase();
    var html='';
    if(type.indexOf("portada")>=0) html=hero(t);
    else if(type.indexOf("tarjeta")>=0 || title.indexOf("fundamento")>=0) html=cards(t);
    else if(type.indexOf("diagrama")>=0 || title.indexOf("alcance")>=0) html=diagram(t);
    else if(type.indexOf("indicador")>=0 || /48|24|12|15|18/.test((t.keyMessage||"")+" "+(t.description||""))) html=stats(t);
    else if(type.indexOf("canal")>=0 || title.indexOf("denuncia")>=0) html=whistle(t);
    else if(type.indexOf("compromiso")>=0 || title.indexOf("compromiso")>=0) html=commitment(t);
    else if(t.embedUrl) html=videoPrinciple(t);
    else if(type.indexOf("principio")>=0 || title.indexOf("principio")>=0) html=principle(t);
    else html=textScreen(t);
    el.topicStage.innerHTML=html;
    renderContextActions(t);
  }

  function baseHead(t){ return '<p class="cap-eyebrow">'+esc(t.section)+'</p><h1 class="cap-title">'+esc(t.title)+'</h1>'+(t.subtitle?'<p class="cap-lead">'+esc(t.subtitle)+'</p>':''); }
  function allText(t){ return [t.keyMessage,t.description,t.supportText].filter(Boolean); }
  function paragraphs(t){ return allText(t).map(function(x){return '<p>'+esc(x)+'</p>';}).join(''); }
  function splitLines(t){ return (t.description||t.supportText||t.keyMessage||"").split(/\n|\||;/).map(function(x){return x.trim();}).filter(Boolean); }

  function hero(t){ return '<article class="cap-content cap-content--hero">'+baseHead(t)+'<div class="cap-highlight">'+esc(t.keyMessage||t.description||"")+'</div>'+(t.supportText?'<p class="cap-lead">'+esc(t.supportText)+'</p>':'')+'</article>'; }
  function cards(t){ var items=splitLines(t); if(items.length<2) items=allText(t); return '<article class="cap-content">'+baseHead(t)+'<div class="cap-card-grid">'+items.map(function(x,i){var p=x.split(":"); return '<div class="cap-card cap-stagger" style="--i:'+i+'"><span class="cap-card__index">'+String(i+1).padStart(2,"0")+'</span><h3>'+esc(p[0])+'</h3><p>'+esc(p.slice(1).join(":")||x)+'</p></div>';}).join('')+'</div></article>'; }
  function diagram(t){ var items=splitLines(t); return '<article class="cap-content">'+baseHead(t)+'<div class="cap-diagram"><div class="cap-diagram__center">Código de Ética</div>'+items.map(function(x,i){return '<div class="cap-diagram__node cap-stagger" style="--i:'+i+'">'+esc(x)+'</div>';}).join('')+'</div>'+(t.supportText?'<p class="cap-body-copy">'+esc(t.supportText)+'</p>':'')+'</article>'; }
  function stats(t){ var items=splitLines(t); if(items.length<2) items=allText(t); return '<article class="cap-content">'+baseHead(t)+'<div class="cap-stat-grid">'+items.map(function(x,i){var m=x.match(/(<\s*)?(\d+)\s*(horas?|años?|h)?/i); var num=m?m[2]:String(i+1); var label=x.replace(m?m[0]:"","").replace(/^[:\-–]\s*/,""); return '<div class="cap-stat-card cap-stagger" style="--i:'+i+'"><strong data-count="'+esc(num)+'">'+esc(num)+'</strong><span>'+esc((m&&m[3]?m[3]+" ":"")+label)+'</span></div>';}).join('')+'</div></article>'; }
  function principle(t){ return '<article class="cap-content cap-principle">'+baseHead(t)+'<div class="cap-principle__number">'+esc(extractNumber(t.title))+'</div><div class="cap-principle__copy">'+paragraphs(t)+'</div></article>'; }
  function videoPrinciple(t){ return '<article class="cap-content cap-video-principle">'+baseHead(t)+'<div class="cap-video-principle__grid"><div><div class="cap-principle__copy">'+paragraphs(t)+'</div></div><button class="cap-video-poster" type="button" data-open-video="'+esc(t.id)+'"><span class="cap-play">▶</span><strong>Reproducir recurso audiovisual</strong><small>'+esc(t.duration||"Video de apoyo")+'</small></button></div></article>'; }
  function whistle(t){ return '<article class="cap-content cap-whistle">'+baseHead(t)+'<div class="cap-whistle__shield">Confidencial<br>y sin represalias</div><div class="cap-contact-grid">'+(t.contactEmail?'<div><span>Correo electrónico</span><strong>'+esc(t.contactEmail)+'</strong></div>':'')+(t.contactPhone?'<div><span>Teléfono</span><strong>'+esc(t.contactPhone)+'</strong></div>':'')+'</div><div class="cap-body-copy">'+paragraphs(t)+'</div></article>'; }
  function commitment(t){ return '<article class="cap-content cap-commitment">'+baseHead(t)+'<blockquote>'+esc(t.keyMessage||t.description||"")+'</blockquote>'+(t.supportText?'<p class="cap-body-copy">'+esc(t.supportText)+'</p>':'')+'<div class="cap-signature-lines"><span>Nombre y firma</span><span>Cargo u organización</span></div></article>'; }
  function textScreen(t){ return '<article class="cap-content cap-text-screen">'+baseHead(t)+(t.keyMessage?'<div class="cap-highlight">'+esc(t.keyMessage)+'</div>':'')+'<div class="cap-body-copy">'+[t.description,t.supportText].filter(Boolean).map(function(x){return '<p>'+esc(x)+'</p>';}).join('')+'</div></article>'; }

  function renderContextActions(t){
    var a='<button class="cap-btn cap-btn--ghost" data-topic-action="prev" type="button">← Anterior</button>';
    if(t.embedUrl) a+='<button class="cap-btn cap-btn--secondary" data-open-video="'+esc(t.id)+'" type="button">Reproducir video</button>';
    a+='<button class="cap-btn cap-btn--primary" data-topic-action="next" type="button">Siguiente →</button>';
    el.topicContextActions.innerHTML=a;
    el.topicContextActions.querySelector('[data-topic-action="prev"]').onclick=prev;
    el.topicContextActions.querySelector('[data-topic-action="next"]').onclick=next;
  }

  function renderRegistro(){
    var s=state.data.session||{}, c=state.data.course||{};
    el.registroFolio.textContent=s.folio||"—"; el.registroCourse.textContent=c.name||"—";
    setPill(!!s.registrationOpen);
    if(s.qrUrl){el.qrRegistroImg.src=s.qrUrl;el.qrRegistroBox.hidden=false;el.qrRegistroPlaceholder.hidden=true;}else{el.qrRegistroBox.hidden=true;el.qrRegistroPlaceholder.hidden=false;}
    updateCount();
  }
  function renderEvaluacion(){
    var s=state.data.session||{}, e=state.data.evaluation||{};
    if(e.available&&s.qrUrl){el.evalQrImg.src=s.qrUrl;el.evalQrBox.hidden=false;el.evalUnavailable.hidden=true;}else{el.evalQrBox.hidden=true;el.evalUnavailable.hidden=false;}
    el.evalTime.textContent=e.duration||"Según cuestionario"; el.evalMinScore.textContent=e.minScore!=null?e.minScore+"%":"—"; el.evalMaxAttempts.textContent=e.maxAttempts!=null?e.maxAttempts:"—";
  }
  function setPill(open){ el.registroStatus.textContent=open?"Registro abierto":"Registro cerrado"; el.registroStatus.className="cap-status-pill "+(open?"is-open":"is-closed"); }
  function updateCount(){var s=state.data.session||{}; el.attendeeTotal.textContent=s.totalRegistered!=null?s.totalRegistered:"—";el.attendeeCapacity.textContent=s.capacity!=null?s.capacity:"Sin límite";el.attendeeUpdated.textContent=new Date().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"});}
  function refreshCount(){el.btnRefreshCount.disabled=true;el.btnRefreshCount.textContent="Actualizando…";ICAC_API.getPresentation(state.token).then(function(r){if(r&&r.success){state.data.session=Object.assign(state.data.session||{},r.data.session||{});renderRegistro();toast("Conteo actualizado");}}).finally(function(){el.btnRefreshCount.disabled=false;el.btnRefreshCount.textContent="Actualizar conteo";});}

  function openVideo(id){ var t=find(id); if(!t||!t.embedUrl)return; state.currentVideo=t; el.videoModalTitle.textContent=t.title; el.videoModalFrame.src=withAutoplay(t.embedUrl); el.videoModal.hidden=false; document.body.classList.add("modal-open"); }
  function closeVideo(){el.videoModal.hidden=true;el.videoModalFrame.src="";state.currentVideo=null;document.body.classList.remove("modal-open");}
  function restartVideo(){if(!state.currentVideo)return;el.videoModalFrame.src="";setTimeout(function(){el.videoModalFrame.src=withAutoplay(state.currentVideo.embedUrl);},40);}
  function withAutoplay(u){return u+(u.indexOf("?")>=0?"&":"?")+"autoplay=1&rel=0&modestbranding=1";}

  function action(a){ if(a==="inicio")go(null); if(a==="prev")prev(); if(a==="next")next(); if(a==="show-registro")go("registro"); if(a==="show-evaluacion")go("evaluacion"); if(a==="show-cierre")go("cierre"); if(a==="fullscreen")toggleFullscreen(); }
  function keys(e){ if(el.presentation.hidden)return; if(!el.videoModal.hidden&&e.key==="Escape")return closeVideo(); if(e.key==="ArrowRight")next(); else if(e.key==="ArrowLeft")prev(); else if(e.key.toLowerCase()==="f")toggleFullscreen(); else if(e.key.toLowerCase()==="r")go("registro"); else if(e.key.toLowerCase()==="e")go("evaluacion"); else if(e.key==="Home")go(null); }
  function firstContent(){var x=state.topics.find(function(t){return t.kind==="contenido";});if(x)go(x.id);}
  function next(){if(state.currentId===null)return firstContent();var i=index(state.currentId);if(i>=0&&i<state.topics.length-1)go(state.topics[i+1].id);}
  function prev(){if(state.currentId===null)return;var i=index(state.currentId);if(i<=0)go(null);else go(state.topics[i-1].id);}
  function find(id){return state.topics.find(function(t){return t.id===id;});}
  function index(id){return state.topics.findIndex(function(t){return t.id===id;});}

  function updateNav(){document.querySelectorAll(".cap-nav-item").forEach(function(b){b.classList.toggle("is-active",b.dataset.topic===state.currentId);});}
  function updateProgress(){var total=state.topics.length, current=state.currentId===null?0:index(state.currentId)+1;el.progressText.textContent=current+" / "+total;el.progressBar.style.width=(total?current/total*100:0)+"%";}
  function animateScreen(){el.capMain.classList.remove("is-entering");void el.capMain.offsetWidth;el.capMain.classList.add("is-entering");setTimeout(animateCounters,100);}
  function animateCounters(){document.querySelectorAll("[data-count]").forEach(function(n){var end=parseInt(n.dataset.count,10);if(!isFinite(end))return;var start=0,t0=performance.now(),dur=600;function tick(t){var p=Math.min(1,(t-t0)/dur);n.textContent=Math.round(start+(end-start)*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(tick);}requestAnimationFrame(tick);});}
  function toggleNav(force){state.navOpen=typeof force==="boolean"?force:!state.navOpen;el.capNav.classList.toggle("is-closed",!state.navOpen);document.body.classList.toggle("nav-closed",!state.navOpen);}
  function toggleFullscreen(){if(document.fullscreenElement)exitFullscreen();else el.presentation.requestFullscreen&&el.presentation.requestFullscreen().catch(function(){});}
  function exitFullscreen(){if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(function(){});}
  function fullscreenUi(){el.btnExitFullscreen.hidden=!document.fullscreenElement;}
  function setStatus(s){state.status=s;persistState(state.currentId,s);}
  function persistState(id,status){if(state.token)ICAC_API.updatePresentation(state.token,id,status).catch(function(){});}
  function toast(msg){var x=document.createElement("div");x.className="cap-toast";x.textContent=msg;document.body.appendChild(x);setTimeout(function(){x.classList.add("is-visible");},10);setTimeout(function(){x.classList.remove("is-visible");setTimeout(function(){x.remove();},250);},1800);}
  function extractNumber(s){var m=(s||"").match(/\d+/);return m?m[0]:"•";}
  function formatDate(v){if(!v)return"Por confirmar";var d=new Date(v);return isNaN(d)?"Por confirmar":d.toLocaleDateString("es-MX",{day:"numeric",month:"long",year:"numeric"});}
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
})();
