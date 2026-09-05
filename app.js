
const cfg=window.BLUEME_CONFIG;
const sb=window.supabase.createClient(cfg.url,cfg.key);
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let POSTS=[],FILTER="all";

function toast(m){const e=$("#toast");if(!e)return;e.textContent=m;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1800)}
function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function dateFmt(v){try{return new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v))}catch{return""}}
function mediaUrl(path){if(!path)return"";return sb.storage.from(cfg.bucket).getPublicUrl(path).data.publicUrl}

async function loadPosts(){
  let q=sb.from("posts").select("*").order("sort_order",{ascending:false}).order("created_at",{ascending:false});
  if(!window.BLUEME_ADMIN_PAGE)q=q.eq("published",true);
  const {data,error}=await q;
  if(error){$("#feed").innerHTML=`<div class="empty">Gagal memuat postingan: ${esc(error.message)}</div>`;return}
  POSTS=data||[];
  if($("#postCount"))$("#postCount").textContent=POSTS.length;
  render()
}
function render(){
  const list=FILTER==="all"?POSTS:POSTS.filter(p=>p.media_type===FILTER);
  if(!list.length){$("#feed").innerHTML='<div class="empty">Belum ada postingan.</div>';return}
  $("#feed").innerHTML=list.map(p=>{
    const u=mediaUrl(p.media_url);
    let media="";
    if(p.media_type==="image"&&u)media=`<img class="post-media" src="${esc(u)}" alt="">`;
    if(p.media_type==="video"&&u)media=`<video class="post-media" src="${esc(u)}" controls playsinline preload="metadata"></video>`;
    return `<article class="post"><div class="post-top"><div class="author-row"><div class="author"><div class="mini">BC</div><div><b>BLUE CREATOR ✓</b><small>${dateFmt(p.created_at)}</small></div></div>${window.BLUEME_ADMIN_PAGE?`<button class="action danger delete-post" data-id="${esc(p.id)}" data-path="${esc(p.media_url||"")}">Hapus</button>`:""}</div>${p.title?`<h3 class="post-title">${esc(p.title)}</h3>`:""}${p.caption?`<p class="post-caption">${esc(p.caption)}</p>`:""}</div>${media}<div class="post-actions"><div><button class="action like">♡ Like</button> <button class="action share">↗ Share</button></div><small>BLUEME</small></div></article>`
  }).join("")
}
$$(".tab").forEach(b=>b.addEventListener("click",()=>{FILTER=b.dataset.filter;$$(".tab").forEach(x=>x.classList.toggle("active",x===b));render()}));
document.addEventListener("click",async e=>{
  const l=e.target.closest(".like");if(l){l.textContent=l.textContent.includes("♡")?"♥ Liked":"♡ Like";return}
  if(e.target.closest(".share")){try{if(navigator.share)await navigator.share({title:document.title,url:location.href});else{await navigator.clipboard.writeText(location.href);toast("Link disalin")}}catch{}}
  const d=e.target.closest(".delete-post");
  if(d){if(!confirm("Hapus postingan ini?"))return;const {error}=await sb.from("posts").delete().eq("id",d.dataset.id);if(error){toast(error.message);return}if(d.dataset.path)await sb.storage.from(cfg.bucket).remove([d.dataset.path]);toast("Postingan dihapus");await loadPosts()}
});
$("#shareProfile")?.addEventListener("click",async()=>{try{if(navigator.share)await navigator.share({title:document.title,url:location.href});else{await navigator.clipboard.writeText(location.href);toast("Link disalin")}}catch{}});

async function adminInit(){
  const login=$("#loginPanel"),dash=$("#dashboard"),logout=$("#logoutBtn");
  async function enter(session){
    if(!session?.user)return false;
    const {data,error}=await sb.from("admins").select("user_id").eq("user_id",session.user.id).maybeSingle();
    if(error||!data){await sb.auth.signOut();toast("Akun ini bukan admin");return false}
    login.classList.add("hidden");dash.classList.remove("hidden");logout.classList.remove("hidden");await loadPosts();return true
  }
  const {data:{session}}=await sb.auth.getSession();if(session)await enter(session);
  $("#loginBtn").addEventListener("click",async()=>{const status=$("#loginStatus");status.textContent="Memeriksa...";const {data,error}=await sb.auth.signInWithPassword({email:$("#email").value.trim(),password:$("#password").value});if(error){status.textContent=error.message;return}if(await enter(data.session))status.textContent=""});
  $("#password").addEventListener("keydown",e=>{if(e.key==="Enter")$("#loginBtn").click()});
  logout.addEventListener("click",async()=>{await sb.auth.signOut();location.reload()});
  const modal=$("#composer");
  $("#openComposer").addEventListener("click",()=>modal.classList.add("open"));
  $$("[data-close]").forEach(x=>x.addEventListener("click",()=>modal.classList.remove("open")));
  $("#postMedia").addEventListener("change",e=>{const f=e.target.files[0],p=$("#preview");if(!f){p.classList.add("hidden");return}const img=f.type.startsWith("image/"),vid=f.type.startsWith("video/");if(!img&&!vid){toast("File harus gambar atau video");e.target.value="";return}const max=img?5*1024*1024:50*1024*1024;if(f.size>max){toast(img?"Gambar maksimal 5 MB":"Video maksimal 50 MB");e.target.value="";return}const u=URL.createObjectURL(f);p.classList.remove("hidden");p.innerHTML=img?`<img src="${u}">`:`<video src="${u}" controls></video>`});
  $("#publishBtn").addEventListener("click",async()=>{
    const title=$("#postTitle").value.trim(),caption=$("#postCaption").value.trim(),file=$("#postMedia").files[0],st=$("#uploadProgress");
    if(!title&&!caption&&!file){toast("Postingan masih kosong");return}
    let type="text",path=null;
    if(file){
      const img=file.type.startsWith("image/"),vid=file.type.startsWith("video/");if(!img&&!vid){toast("Format tidak didukung");return}
      const max=img?5*1024*1024:50*1024*1024;if(file.size>max){toast(img?"Gambar maksimal 5 MB":"Video maksimal 50 MB");return}
      type=img?"image":"video";const ext=(file.name.split(".").pop()||"bin").replace(/[^a-z0-9]/gi,"").toLowerCase();path=`posts/${Date.now()}-${crypto.randomUUID()}.${ext}`;st.textContent="Mengupload media...";
      const {error}=await sb.storage.from(cfg.bucket).upload(path,file,{upsert:false,contentType:file.type});if(error){st.textContent="";toast(error.message);return}
    }
    st.textContent="Menyimpan postingan...";
    const {error}=await sb.from("posts").insert({title:title||null,caption:caption||null,media_type:type,media_url:path,published:true});
    if(error){if(path)await sb.storage.from(cfg.bucket).remove([path]);st.textContent="";toast(error.message);return}
    $("#postTitle").value="";$("#postCaption").value="";$("#postMedia").value="";$("#preview").innerHTML="";$("#preview").classList.add("hidden");st.textContent="";modal.classList.remove("open");toast("Postingan berhasil dipublish");await loadPosts()
  });
}
if(window.BLUEME_ADMIN_PAGE)adminInit();else loadPosts();
