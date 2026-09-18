const items = window.POE2_UNIQUES || [];
const STORAGE_KEY = "poe2-unique-tracker:v1";
const categories = ["All", ...new Set(items.map((item) => item.category.trim()))];

let collected = loadCollected();
let activeCategory = "All";
let activeStatus = "all";
let searchTerm = "";
let currentDialogItem = null;

// Selectors (Trimmed to match HTML IDs exactly)
const itemGrid = document.querySelector("#itemGrid");
const categoryStrip = document.querySelector("#categoryStrip");
const searchInput = document.querySelector("#searchInput");
const collectedCount = document.querySelector("#collectedCount");
const totalCount = document.querySelector("#totalCount");
const remainingCount = document.querySelector("#remainingCount");
const percentText = document.querySelector("#percentText");
const progressRing = document.querySelector("#progressRing");
const itemDialog = document.querySelector("#itemDialog");
const dialogImage = document.querySelector("#dialogImage");
const dialogName = document.querySelector("#dialogName");
const dialogMeta = document.querySelector("#dialogMeta");
const dialogToggle = document.querySelector("#dialogToggle");

function loadCollected() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
        return new Set();
    }
}

function saveCollected() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...collected].sort()));
}

function filteredItems() {
    const needle = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
        // Trim IDs and categories to handle data.js spacing issues
        const itemId = item.id.trim();
        const itemCat = item.category.trim();
        
        const isCollected = collected.has(itemId);
        const categoryOk = activeCategory === "All" || itemCat === activeCategory;
        const statusOk =
            activeStatus === "all" ||
            (activeStatus === "collected" && isCollected) ||
            (activeStatus === "missing" && !isCollected);
        const textOk =
            !needle ||
            item.name.toLowerCase().includes(needle) ||
            item.baseType.toLowerCase().includes(needle) ||
            itemCat.toLowerCase().includes(needle);
        return categoryOk && statusOk && textOk;
    });
}

function renderCategories() {
    categoryStrip.innerHTML = "";
    categories.forEach((category) => {
        const count = category === "All" ? items.length : items.filter((item) => item.category.trim() === category).length;
        const button = document.createElement("button");
        button.type = "button";
        button.className = `category-chip${category === activeCategory ? " active" : ""}`;
        button.textContent = `${category} ${count}`;
        button.addEventListener("click", () => {
            activeCategory = category;
            render();
        });
        categoryStrip.appendChild(button);
    });
}

function renderSummary() {
    const total = items.length;
    const owned = collected.size;
    const percent = total ? Math.round((owned / total) * 100) : 0;
    totalCount.textContent = total;
    collectedCount.textContent = owned;
    remainingCount.textContent = total - owned;
    percentText.textContent = `${percent}%`;
    if (progressRing) {
        progressRing.style.background = `conic-gradient(var(--orange) ${percent * 3.6}deg, #34281d 0deg)`;
    }
}

function renderItems() {
    const visible = filteredItems();
    itemGrid.innerHTML = "";
    if (!visible.length) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = "No uniques found.";
        itemGrid.appendChild(empty);
        return;
    }
    const fragment = document.createDocumentFragment();
    visible.forEach((item) => {
        const itemId = item.id.trim();
        const owned = collected.has(itemId);
        const card = document.createElement("article");
        card.className = `item-card${owned ? " collected" : ""}`;
        
        const detailButton = document.createElement("button");
        detailButton.type = "button";
        detailButton.className = "item-button";
        detailButton.addEventListener("click", () => openItem(item));
        
        const thumb = document.createElement("span");
        thumb.className = "thumb";
        const img = document.createElement("img");
        img.src = item.image.trim();
        img.alt = item.name;
        img.loading = "lazy";
        thumb.appendChild(img);
        
        const copy = document.createElement("span");
        const name = document.createElement("span");
        name.className = "item-name";
        name.textContent = item.name;
        const meta = document.createElement("span");
        meta.className = "item-meta";
        meta.textContent = itemMeta(item);
        copy.append(name, meta);
        
        detailButton.append(thumb, copy);
        
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "toggle-owned";
        toggle.textContent = owned ? "Owned" : "Missing";
        toggle.addEventListener("click", () => toggleItem(itemId));
        
        card.append(detailButton, toggle);
        fragment.appendChild(card);
    });
    itemGrid.appendChild(fragment);
}

function itemMeta(item) {
    const parts = [item.category.trim()];
    if (item.baseType) parts.push(item.baseType);
    if (item.requiredLevel) parts.push(`Lv ${item.requiredLevel}`);
    return parts.join(" · ");
}

function toggleItem(id) {
    if (collected.has(id)) {
        collected.delete(id);
    } else {
        collected.add(id);
    }
    saveCollected();
    renderSummary();
    renderItems();
    updateDialogButton();
}

function openItem(item) {
    currentDialogItem = item;
    dialogImage.src = item.image.trim();
    dialogImage.alt = item.name;
    dialogName.textContent = item.name;
    dialogMeta.textContent = itemMeta(item);
    updateDialogButton();
    itemDialog.showModal();
}

function updateDialogButton() {
    if (!currentDialogItem) return;
    dialogToggle.textContent = collected.has(currentDialogItem.id.trim()) ? "Mark Missing" : "Mark Owned";
}

function render() {
    renderCategories();
    renderSummary();
    renderItems();
}

function downloadProgress() {
    const payload = {
        app: "POE2 Unique Tracker",
        exportedAt: new Date().toISOString(),
        collected: [...collected].sort(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "poe2-unique-progress.json";
    link.click();
    URL.revokeObjectURL(link.href);
}

function importProgress(file) {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
        try {
            const parsed = JSON.parse(String(reader.result || "{}"));
            const incoming = Array.isArray(parsed) ? parsed : parsed.collected;
            if (!Array.isArray(incoming)) return;
            const validIds = new Set(items.map((item) => item.id.trim()));
            collected = new Set(incoming.filter((id) => validIds.has(id.trim())));
            saveCollected();
            render();
        } catch {
            return;
        }
    });
    reader.readAsText(file);
}

// Event Listeners
document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
        activeStatus = button.dataset.status;
        document.querySelectorAll(".segment").forEach((segment) => segment.classList.remove("active"));
        button.classList.add("active");
        renderItems();
    });
});

searchInput.addEventListener("input", (event) => {
    searchTerm = event.target.value;
    renderItems();
});

document.querySelector("#markVisibleButton").addEventListener("click", () => {
    filteredItems().forEach((item) => collected.add(item.id.trim()));
    saveCollected();
    render();
});

document.querySelector("#clearVisibleButton").addEventListener("click", () => {
    filteredItems().forEach((item) => collected.delete(item.id.trim()));
    saveCollected();
    render();
});

document.querySelector("#exportButton").addEventListener("click", downloadProgress);
document.querySelector("#importButton").addEventListener("click", () => document.querySelector("#importFile").click());
document.querySelector("#importFile").addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) importProgress(file);
    event.target.value = "";
});

document.querySelector("#dialogClose").addEventListener("click", () => itemDialog.close());
dialogToggle.addEventListener("click", () => {
    if (currentDialogItem) toggleItem(currentDialogItem.id.trim());
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js");
}

render();
