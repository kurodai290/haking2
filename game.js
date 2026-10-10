(()=>{
 const n=Number(document.body.dataset.stage||0);
 const input=document.getElementById("a");
 const button=document.getElementById("b");
 const result=document.getElementById("r");
 const showError=(msg)=>{if(result){result.textContent=msg;result.className="warning";}};
 if(!n) return;
 fetch("/api/progress",{credentials:"same-origin"})
  .then(r=>r.json())
  .then(p=>{if(n>p.unlocked){location.replace(p.unlocked>=16?"complete.html":`stage${String(p.unlocked).padStart(2,"0")}.html`);}})
  .catch(()=>showError("サーバーとの接続に失敗しました。ページを再読み込みしてください。"));
 if(n===7){
   localStorage.setItem("debug_mode","false");
   localStorage.setItem("A19","discard");
   localStorage.setItem("Q19","VAULT");
   localStorage.setItem("random_note","ignore");
 }
 if(n===8){fetch("archive.json").then(r=>r.json()).then(d=>console.log("network archive",d)).catch(()=>{});}
 if(n===13){
   sessionStorage.setItem("route","timetable.html");
   sessionStorage.setItem("decoy","not-real.html");
   fetch("archive.json").then(r=>r.json()).then(d=>console.log("route metadata",d.metadata)).catch(()=>{});
 }
 if(!input||!button||!result)return;
 button.addEventListener("click",async()=>{
   button.disabled=true;
   result.textContent="サーバーで検証中…";
   result.className="";
   try{
     const response=await fetch("/api/verify",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({stage:n,answer:input.value})});
     const data=await response.json();
     if(response.ok&&data.ok){
       result.textContent="PASS — 次の調査先を開きます…";
       result.className="ok";
       setTimeout(()=>location.href=data.next,500);
     }else{showError(data.message||"NO — 証拠をもう一度照合してください。");button.disabled=false;}
   }catch(e){showError("サーバーとの接続に失敗しました。しばらくして再試行してください。");button.disabled=false;}
 });
})();