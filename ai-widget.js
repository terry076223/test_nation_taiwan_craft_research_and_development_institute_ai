/*
 * ai-widget.js — 工藝詢問 AI 小幫手 Widget
 *
 * 使用方式：在 </body> 前加入 <script src="ai-widget.js"></script>
 * 同時需在頁面中加入 ai-widget.css 與以下 HTML 結構：
 *   1. <button id="aiNavBtn" class="ai-nav-btn">🤖 工藝詢問AI小幫手</button>
 *   2. Bot 選擇 Modal（id="botSelectOverlay"）
 *   3. 對話視窗（id="chatModal"）
 * 完整 HTML 片段請參考 ai-integration-snippet.html
 */
(function () {

  // ── 預設機器人（若 localStorage 尚無設定時使用）──
  var DEFAULT_BOTS = [
    {id:'bot-001',name:'工藝材料助手',icon:'🏺',description:'詢問各類工藝材料、工具使用方式及技法',active:true,apiUrl:'',apiToken:'',customHeaders:'',requestTemplate:'{"contents":[{"parts":[{"text":"{{message}}"}]}]}',responseField:'candidates.0.content.parts.0.text'},
    {id:'bot-002',name:'技法教學助手',icon:'🖌️',description:'學習傳統工藝技法步驟與製作方式',active:true,apiUrl:'',apiToken:'',customHeaders:'',requestTemplate:'{"contents":[{"parts":[{"text":"{{message}}"}]}]}',responseField:'candidates.0.content.parts.0.text'},
    {id:'bot-003',name:'作品鑑賞助手',icon:'🔍',description:'上傳圖片進行工藝品鑑賞與分析',active:true,apiUrl:'',apiToken:'',customHeaders:'',requestTemplate:'{"contents":[{"parts":[{"text":"{{message}}"}]}]}',responseField:'candidates.0.content.parts.0.text'},
    {id:'bot-004',name:'活動查詢助手',icon:'📅',description:'查詢展覽、活動與課程相關資訊',active:true,apiUrl:'',apiToken:'',customHeaders:'',requestTemplate:'{"contents":[{"parts":[{"text":"{{message}}"}]}]}',responseField:'candidates.0.content.parts.0.text'}
  ];

  // ── 狀態變數 ──
  var currentBot = null, chatHistory = [], pendingImageBase64 = '';

  // ── Bot 設定讀取（優先順序：bots-config.json → localStorage → DEFAULT_BOTS）──
  var CONFIG_URL = window.AI_WIDGET_CONFIG_URL || 'bots-config.json';
  async function getBotsConfig(){
    try{
      var res=await fetch(CONFIG_URL);
      if(res.ok){
        var cfg=await res.json();
        var list=cfg.bots||cfg; // 支援新格式 {bots:[...]} 和舊格式 [...]
        if(Array.isArray(list)&&list.length) return list;
      }
    }catch(e){}
    try{
      var s=localStorage.getItem('ntcri_ai_bots');
      if(s){ var d=JSON.parse(s); if(Array.isArray(d)&&d.length) return d; }
    }catch(e){}
    return DEFAULT_BOTS;
  }
  function escForJSON(s){
    return s.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r').replace(/\t/g,'\\t');
  }
  function getNestedVal(obj,path){
    return path.split('.').reduce(function(o,k){return o!=null?o[k]:undefined;},obj);
  }
  function escHtml(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── API 呼叫 ──
  async function callBotAPI(bot,message,imageBase64){
    var tpl=bot.requestTemplate||'{"contents":[{"parts":[{"text":"{{message}}"}]}]}';
    var body=tpl.replace('{{message}}',escForJSON(message))
                .replace('{{image_base64}}',imageBase64||'')
                .replace('{{history_json}}',JSON.stringify(chatHistory));
    var headers={'Content-Type':'application/json'};
    if(bot.apiToken) headers['Authorization']=bot.apiToken;
    if(bot.customHeaders){try{Object.assign(headers,JSON.parse(bot.customHeaders));}catch(e){}}
    var res=await fetch(bot.apiUrl,{method:'POST',headers:headers,body:body});
    if(!res.ok) throw new Error('HTTP '+res.status);
    var data=await res.json();
    var text=getNestedVal(data,bot.responseField);
    if(text==null) throw new Error('無法解析回應（欄位：'+bot.responseField+'）');
    return String(text);
  }

  // ── 回饋儲存 ──
  function saveFeedback(rating,question,answer){
    var payload={
      ts:new Date().toISOString(),
      botId:currentBot?currentBot.id:'',
      botName:currentBot?currentBot.name:'',
      question:question||'',
      answer:answer||'',
      rating:rating
    };
    var gasUrl=localStorage.getItem('ntcri_gas_url');
    if(gasUrl){
      fetch(gasUrl,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).catch(function(e){console.error('[ai-widget] GAS 寫入失敗',e);});
    } else {
      try{
        var list=JSON.parse(localStorage.getItem('ntcri_ai_feedback')||'[]');
        list.push(payload);
        localStorage.setItem('ntcri_ai_feedback',JSON.stringify(list));
        console.log('[ai-widget] 回饋已儲存，共',list.length,'筆');
      }catch(e){console.error('[ai-widget] localStorage 寫入失敗',e);}
    }
  }

  // ── 訊息渲染 ──
  function addUserMsg(text,imgSrc){
    var msgs=document.getElementById('chatMessages');
    var d=document.createElement('div'); d.className='chat-msg user';
    var c='';
    if(imgSrc) c+='<img src="'+imgSrc+'" style="max-width:160px;border-radius:8px;margin-bottom:4px;display:block;">';
    if(text) c+=escHtml(text);
    d.innerHTML='<div class="chat-bubble">'+c+'</div>';
    msgs.appendChild(d); msgs.scrollTop=msgs.scrollHeight;
  }
  function addBotMsg(text,noFeedback,userQuestion){
    var msgs=document.getElementById('chatMessages');
    var d=document.createElement('div'); d.className='chat-msg bot';
    var feedback=noFeedback?'':'<div class="chat-feedback"><button class="fb-btn like-btn" title="有幫助">👍</button><button class="fb-btn dislike-btn" title="沒幫助">👎</button></div>';
    d.innerHTML='<div><div class="chat-bubble">'+escHtml(text)+'</div>'+feedback+'</div>';
    msgs.appendChild(d);
    if(!noFeedback){
      var likeBtn=d.querySelector('.like-btn');
      var dislikeBtn=d.querySelector('.dislike-btn');
      likeBtn.addEventListener('click',function(){
        var wasLiked=likeBtn.classList.contains('liked');
        likeBtn.classList.toggle('liked');
        dislikeBtn.classList.remove('disliked');
        if(!wasLiked) saveFeedback(1,userQuestion,text);
      });
      dislikeBtn.addEventListener('click',function(){
        var wasDisliked=dislikeBtn.classList.contains('disliked');
        dislikeBtn.classList.toggle('disliked');
        likeBtn.classList.remove('liked');
        if(!wasDisliked) saveFeedback(-1,userQuestion,text);
      });
    }
    msgs.scrollTop=msgs.scrollHeight;
  }
  function addTyping(){
    var msgs=document.getElementById('chatMessages');
    var d=document.createElement('div'); d.className='chat-msg bot'; d.id='chatTyping';
    d.innerHTML='<div class="chat-typing"><span></span><span></span><span></span></div>';
    msgs.appendChild(d); msgs.scrollTop=msgs.scrollHeight;
  }
  function removeTyping(){var el=document.getElementById('chatTyping');if(el)el.remove();}

  // ── 圖片預覽 ──
  function clearImgPreview(){
    pendingImageBase64='';
    document.getElementById('chatImgThumb').src='';
    document.getElementById('chatImgPreview').style.display='none';
  }

  // ── 發送訊息 ──
  async function sendMsg(){
    if(!currentBot) return;
    var input=document.getElementById('chatInput');
    var text=input.value.trim();
    var imgB64=pendingImageBase64;
    var imgSrc=imgB64?'data:image/jpeg;base64,'+imgB64:'';
    if(!text&&!imgB64) return;
    if(!currentBot.apiUrl){
      addBotMsg('⚠️ 此機器人尚未設定 API，請管理員至 admin.html 配置 API 連結。');
      return;
    }
    input.value=''; clearImgPreview();
    addUserMsg(text,imgSrc);
    chatHistory.push({role:'user',content:text+(imgB64?' [附圖]':'')});
    document.getElementById('chatSendBtn').disabled=true;
    addTyping();
    try{
      var reply=await callBotAPI(currentBot,text,imgB64);
      removeTyping(); addBotMsg(reply,false,text);
      chatHistory.push({role:'assistant',content:reply});
    }catch(err){
      removeTyping(); addBotMsg('⚠️ 錯誤：'+err.message);
    }finally{
      document.getElementById('chatSendBtn').disabled=false;
      document.getElementById('chatMessages').scrollTop=9999;
    }
  }

  // ── 開啟對話視窗 ──
  function openChat(bot){
    document.getElementById('botSelectOverlay').classList.remove('show');
    currentBot=bot; chatHistory=[];
    document.getElementById('chatBotIcon').textContent=bot.icon;
    document.getElementById('chatBotName').textContent=bot.name;
    document.getElementById('chatMessages').innerHTML='';
    document.getElementById('chatInput').value='';
    clearImgPreview();
    document.getElementById('chatModal').classList.add('show');
    addBotMsg('您好！我是「'+bot.name+'」，'+(bot.description||'')+'。請問有什麼我可以幫您的？',true);
  }

  // ── 初始化事件繫結 ──
  function init(){
    // Bot 選擇 Modal
    var navBtn=document.getElementById('aiNavBtn');
    if(navBtn){
      navBtn.addEventListener('click',async function(){
        var allBots=await getBotsConfig();
        var bots=allBots.filter(function(b){return b.active;});
        var grid=document.getElementById('botGrid');
        grid.innerHTML='';
        if(bots.length===0){
          grid.style.cssText='display:block;';
          grid.innerHTML='<div class="bot-empty">尚未設定任何機器人，請聯絡管理員</div>';
        } else {
          grid.style.cssText='display:grid;';
          bots.forEach(function(bot){
            var card=document.createElement('div');
            card.className='bot-card';
            card.innerHTML='<div class="bot-card-icon">'+bot.icon+'</div><div class="bot-card-name">'+escHtml(bot.name)+'</div><div class="bot-card-desc">'+escHtml(bot.description)+'</div>';
            card.addEventListener('click',function(){openChat(bot);});
            grid.appendChild(card);
          });
        }
        document.getElementById('botSelectOverlay').classList.add('show');
      });
    }
    var closeOverlay=document.getElementById('botSelectClose');
    if(closeOverlay) closeOverlay.addEventListener('click',function(){
      document.getElementById('botSelectOverlay').classList.remove('show');
    });
    var overlay=document.getElementById('botSelectOverlay');
    if(overlay) overlay.addEventListener('click',function(e){
      if(e.target===this) this.classList.remove('show');
    });

    // 對話視窗
    var chatClose=document.getElementById('chatClose');
    if(chatClose) chatClose.addEventListener('click',function(){
      document.getElementById('chatModal').classList.remove('show');
      currentBot=null; chatHistory=[]; clearImgPreview();
    });
    var sendBtn=document.getElementById('chatSendBtn');
    if(sendBtn) sendBtn.addEventListener('click',sendMsg);
    var chatInput=document.getElementById('chatInput');
    if(chatInput) chatInput.addEventListener('keydown',function(e){
      if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();}
    });

    // 圖片上傳
    var uploadBtn=document.getElementById('chatUploadBtn');
    if(uploadBtn) uploadBtn.addEventListener('click',function(){
      document.getElementById('chatFileInput').click();
    });
    var fileInput=document.getElementById('chatFileInput');
    if(fileInput) fileInput.addEventListener('change',function(e){
      var file=e.target.files[0]; if(!file) return;
      var reader=new FileReader();
      reader.onload=function(ev){
        var dataUrl=ev.target.result;
        pendingImageBase64=dataUrl.split(',')[1];
        document.getElementById('chatImgThumb').src=dataUrl;
        document.getElementById('chatImgPreview').style.display='flex';
      };
      reader.readAsDataURL(file); e.target.value='';
    });
    var imgRemove=document.getElementById('chatImgRemove');
    if(imgRemove) imgRemove.addEventListener('click',clearImgPreview);
  }

  // DOM 已就緒則立即 init，否則等 DOMContentLoaded
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
  } else {
    init();
  }

})();
