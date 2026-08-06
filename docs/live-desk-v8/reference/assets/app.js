const deskNav=[
  ["index.html","▦","Overview"],
  ["whats-new.html","NEW","What's New"],
  ["stories.html","⌘","Stories"],
  ["articles.html","▤","Articles"],
  ["hybrid-output.html","↗","Hybrid Output"]
];

const dataNav=[
  ["macro-data.html","MD","Macro Data"],
  ["heatmaps.html","HM","Heatmaps"],
  ["positioning.html","COT","Positioning"],
  ["charts.html","CH","Charts"],
  ["history.html","▣","History"]
];

const current=location.pathname.split("/").pop()||"index.html";
const link=([href,icon,label])=>`<a class="${current===href?"active":""} ${href==="hybrid-output.html"?"hybrid-link":""}" href="${href}"><b>${icon}</b><span>${label}</span></a>`;
const navRoot=document.querySelector("[data-nav]");

if(navRoot){
  navRoot.innerHTML=`
    <div class="nav-row">
      <span class="nav-row-label">Desk</span>
      <div class="nav-links">${deskNav.map(link).join("")}</div>
    </div>
    <div class="nav-row secondary">
      <span class="nav-row-label">Data &amp; tools</span>
      <div class="nav-links">${dataNav.map(link).join("")}</div>
    </div>`;
}

document.querySelectorAll("[data-year]").forEach(node=>node.textContent=String(new Date().getFullYear()));

document.querySelectorAll("[data-refresh]").forEach(button=>{
  button.addEventListener("click",()=>{
    const original=button.textContent;
    button.textContent="Checking…";
    button.disabled=true;
    setTimeout(()=>{
      button.textContent="No new validated delta";
      setTimeout(()=>{
        button.textContent=original;
        button.disabled=false;
      },1100);
    },650);
  });
});
