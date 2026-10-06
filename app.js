 function shuffleArray(array) {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }


    const Storage = {
      getWords() {
        const data = localStorage.getItem("allWords");
        let words = data ? JSON.parse(data) : [];
        
        if (words.length < DEFAULT_WORDS.length) {
          words = [...DEFAULT_WORDS];
          localStorage.setItem("allWords", JSON.stringify(words));
          
          const localSrs = localStorage.getItem("srsData");
          if (!localSrs || Object.keys(JSON.parse(localSrs)).length < Object.keys(DEFAULT_SRS).length) {
            localStorage.setItem("srsData", JSON.stringify(DEFAULT_SRS));
          }
        }

        let isModified = false;
        words = words.map(w => {
          let updated = { ...w };
          if (updated.transcription === undefined) {
             updated.transcription = "";
             isModified = true;
          }
          if (updated.forms === undefined || typeof updated.forms === 'string') {
             if (typeof updated.forms === 'string' && updated.forms.trim() !== '') {
                 updated.forms = updated.forms.split(';').map(s => {
                    let word = "", translation = "", trans = "";
                    const transMatch = s.match(/\[(.*?)\]/);
                    if (transMatch) {
                      trans = `[${transMatch[1]}]`;
                      s = s.replace(transMatch[0], '').trim();
                    }
                    if (s.includes('-')) {
                      const parts = s.split('-');
                      word = parts[0].trim();
                      translation = parts.slice(1).join('-').trim();
                    } else {
                      word = s.trim();
                    }
                    return { word, translation, transcription: trans };
                 }).filter(f => f.word);
             } else {
                 updated.forms = [];
             }
             isModified = true;
          } else if (Array.isArray(updated.forms)) {
             updated.forms = updated.forms.map(f => {
                if (typeof f === 'string') {
                    isModified = true;
                    return { word: f, translation: "", transcription: "" };
                }
                return f;
             });
          }
          return updated;
        });

        if (isModified) {
          localStorage.setItem("allWords", JSON.stringify(words));
        }
        return words;
      },
      setWords(words) { localStorage.setItem("allWords", JSON.stringify(words)); },
      getSRS() { const d = localStorage.getItem("srsData"); return d ? JSON.parse(d) : DEFAULT_SRS; },
      setSRS(srs) { localStorage.setItem("srsData", JSON.stringify(srs)); },
      getApiKey() { return localStorage.getItem("geminiApiKey") || ""; },
      setApiKey(k) { localStorage.setItem("geminiApiKey", k); },
      getTtsAuto() { const v = localStorage.getItem("ttsAuto"); return v === null ? true : v === "true"; },
      setTtsAuto(v) { localStorage.setItem("ttsAuto", v); },
      getTtsSpeed() { return parseFloat(localStorage.getItem("ttsSpeed")) || 1.0; },
      setTtsSpeed(v) { localStorage.setItem("ttsSpeed", v); }
    };

    const State = {
      words: Storage.getWords(),
      srs: Storage.getSRS(),
      currentCategory: "ALL",
      studyMode: "DUE",
      flashcardMode: "CLASSIC",
      currentCardIndex: 0,
      isFlipped: false,
      lastAction: null,
      lastAiUpdate: null,
      ttsAuto: Storage.getTtsAuto(),
      ttsSpeed: Storage.getTtsSpeed(),
      pendingWordData: null,
      activeKeyIndex: 0
    };

    // --- Экспорт полноценного приложения ---
    document.getElementById("exportHtmlBtn").addEventListener("click", () => {
      const clone = document.documentElement.cloneNode(true);
      
      const tbody = clone.querySelector("#dictionaryTbody");
      if(tbody) tbody.innerHTML = "";
      
      const host = clone.querySelector("#flashcardHost");
      if(host) host.innerHTML = "";
      
      clone.querySelectorAll(".tab-btn[data-tab]").forEach(b => b.classList.remove("active"));
      clone.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
      
      const cardsTab = clone.querySelector('[data-tab="cardsView"]');
      if(cardsTab) cardsTab.classList.add("active");
      
      const cardsView = clone.querySelector("#cardsView");
      if(cardsView) cardsView.classList.add("active");

      let htmlString = "<!DOCTYPE html>\n" + clone.outerHTML;
      
      htmlString = htmlString.replace(
        /const DEFAULT_WORDS = \[[\s\S]*?\];/, 
        `const DEFAULT_WORDS = ${JSON.stringify(State.words, null, 2)};`
      ).replace(
        /const DEFAULT_SRS = \{[\s\S]*?\};/, 
        `const DEFAULT_SRS = ${JSON.stringify(State.srs, null, 2)};`
      );

      const blob = new Blob([htmlString], { type: "text/html;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      
      const dateStr = new Date().toISOString().slice(0,10);
      a.download = `Educator_Backup_${dateStr}.html`;
      
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast("📦 Приложение со словарем скачано!");
    });
document.getElementById("exportBtn").addEventListener("click", () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(State.words, null, 2));
      const a = document.createElement("a");
      a.href = dataStr; a.download = "educator_words_backup.json"; document.body.appendChild(a); a.click(); a.remove();
      showToast("💾 База успешно скачана!");
    });
    const apiKeysContainer = document.getElementById("apiKeysContainer");
    const addApiKeyBtn = document.getElementById("addApiKeyBtn");

    function renderApiKeys() {
      const keysStr = Storage.getApiKey();
      let keys = keysStr.split(',').map(k => k.trim()).filter(k => k);
      if (keys.length === 0) keys = [""]; 

      apiKeysContainer.innerHTML = "";
      keys.forEach((key) => addKeyRow(key));
    }

    function addKeyRow(value = "") {
      const row = document.createElement('div');
      row.className = 'api-key-row';
      
      const input = document.createElement('input');
      input.type = 'password';
      input.placeholder = 'AIzaSy...';
      input.value = value;
      input.className = 'api-key-input';
      
      const eyeBtn = document.createElement('button');
      eyeBtn.type = 'button';
      eyeBtn.className = 'tab-btn-action';
      eyeBtn.style.background = 'transparent';
      eyeBtn.style.padding = '0 10px';
      eyeBtn.style.borderRadius = '4px';
      eyeBtn.style.cursor = 'pointer';
      eyeBtn.style.border = '1px solid var(--card-border)';
      eyeBtn.style.color = 'var(--text-muted)';
      eyeBtn.style.height = '38px';
      eyeBtn.textContent = '👁️';
      eyeBtn.title = 'Показать/Скрыть';
      
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'tab-btn-action';
      delBtn.style.background = 'transparent';
      delBtn.style.padding = '0 10px';
      delBtn.style.borderRadius = '4px';
      delBtn.style.cursor = 'pointer';
      delBtn.style.border = '1px solid var(--danger)';
      delBtn.style.color = 'var(--danger)';
      delBtn.style.height = '38px';
      delBtn.textContent = '✖';
      delBtn.title = 'Удалить ключ';

      input.addEventListener('input', saveAllKeys);
      
      eyeBtn.addEventListener('click', () => {
        if (input.type === 'password') {
          input.type = 'text';
          eyeBtn.textContent = '🙈';
        } else {
          input.type = 'password';
          eyeBtn.textContent = '👁️';
        }
      });

      delBtn.addEventListener('click', () => {
        row.remove();
        saveAllKeys();
        if (apiKeysContainer.children.length === 0) addKeyRow(""); 
      });

      row.appendChild(input);
      row.appendChild(eyeBtn);
      row.appendChild(delBtn);
      apiKeysContainer.appendChild(row);
    }

    function saveAllKeys() {
      const inputs = apiKeysContainer.querySelectorAll('.api-key-input');
      const keys = Array.from(inputs).map(i => i.value.trim()).filter(k => k);
      Storage.setApiKey(keys.join(', '));
    }

    addApiKeyBtn.addEventListener('click', () => {
      addKeyRow("");
      saveAllKeys();
    });

    renderApiKeys();


    async function callGeminiAPI(prompt, audioPart = null, onKeySwitch = null) {
      const keysStr = Storage.getApiKey();
      const keys = keysStr.split(',').map(k => k.trim()).filter(k => k);
      if (keys.length === 0) throw new Error("NO_API_KEY");

      let lastErrorMsg = "";

      for (let i = 0; i < keys.length; i++) {
        const keyIndex = State.activeKeyIndex % keys.length;
        const keyToUse = keys[keyIndex];
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${keyToUse}`;
        
        const payload = { contents: [{ parts: [{ text: prompt }] }] };
        if (audioPart) payload.contents[0].parts.push(audioPart);

        const response = await fetch(url, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.error) {
          const msg = (data.error.message || "").toLowerCase();
          const code = data.error.code;
          if (code === 429 || code === 503 || msg.includes("quota") || msg.includes("exceeded") || msg.includes("high demand")) {
            lastErrorMsg = data.error.message;
            State.activeKeyIndex++; 
            if (i < keys.length - 1) {
              if (onKeySwitch) onKeySwitch((State.activeKeyIndex % keys.length) + 1, keys.length);
              continue;
            }
          } else {
            throw new Error(data.error.message);
          }
        } else {
          return data;
        }
      }
      throw new Error("QUOTA_EXHAUSTED|" + lastErrorMsg);
    }

    function parseRetrySeconds(errorMsg) {
      if (!errorMsg) return 15;
      const match = errorMsg.match(/retry in ([\d\.]+)s/i);
      if (match && match[1]) {
        return Math.ceil(parseFloat(match[1]));
      }
      return 15;
    }

    let toastTimeout = null;
    function showToast(message) {
      const toast = document.getElementById("toastNotice");
      toast.textContent = message;
      toast.classList.add("show");
      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => toast.classList.remove("show"), 3000);
    }

    const bsOverlay = document.getElementById("bsOverlay");
    const wordPanel = document.getElementById("wordPanel");
    const wpClose = document.getElementById("wpClose");
    const wpAddBtn = document.getElementById("wpAddBtn");

    function closePanel() {
      bsOverlay.classList.remove("show");
      wordPanel.classList.remove("show");
    }

    wpClose.addEventListener("click", closePanel);
    bsOverlay.addEventListener("click", closePanel);

    let availableVoices = [];
    function loadVoices() { availableVoices = window.speechSynthesis.getVoices(); }
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
      loadVoices();
    }

    function getBestVoice(langPrefix) {
      if (!availableVoices.length) loadVoices();
      const matchedVoices = availableVoices.filter(v => v.lang.toLowerCase().startsWith(langPrefix.toLowerCase()));
      if (!matchedVoices.length) return null;
      const premiumKeywords = ['google', 'premium', 'natural', 'yandex', 'microsoft irina'];
      for (let keyword of premiumKeywords) {
        const preferred = matchedVoices.find(v => v.name.toLowerCase().includes(keyword));
        if (preferred) return preferred;
      }
      return matchedVoices[0];
    }

    window.currentUtterance = null;
    function speak(text, category) {
      if (!text || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      window.currentUtterance = utterance;
      utterance.rate = State.ttsSpeed;

      const hasCyrillic = /[а-яА-ЯЁё]/.test(text);
      const catLower = (category || "").toLowerCase();
      const isLatinCat = catLower.includes("латын") || catLower.includes("latin") || catLower.includes("римское");

      let targetLang = "ru-RU";
      let langPrefix = "ru";

      if (!hasCyrillic) {
        if (isLatinCat) { targetLang = "it-IT"; langPrefix = "it"; } 
        else if (/[a-zA-Z]/.test(text)) { targetLang = "en-US"; langPrefix = "en"; }
      }

      utterance.lang = targetLang;
      const bestVoice = getBestVoice(langPrefix);
      if (bestVoice) utterance.voice = bestVoice;
      
      utterance.onend = function() {
        window.currentUtterance = null;
      };

      if (window.speechSynthesis.resume) window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    }

    function formatDate(isoStr) {
      if (!isoStr) return "Новое";
      return new Date(isoStr).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
    }

    function getFilteredWords() {
      if (State.currentCategory === "ALL") return State.words;
      return State.words.filter(w => w.category === State.currentCategory);
    }

    function getActiveDeck() {
      const categoryWords = getFilteredWords();
      if (State.studyMode === "ALL") return categoryWords;
      const now = new Date();
      return categoryWords.filter(word => {
        const itemSrs = State.srs[word.id];
        return (!itemSrs || !itemSrs.dueDate) || new Date(itemSrs.dueDate) <= now;
      });
    }

    function tokenizeExample(text) {
      if (!text) return "";
      return text.replace(/([A-Za-zА-Яа-яЁё]+)/g, (match) => {
        const cleanWord = match.toLowerCase();
        const existing = State.words.find(w => {
          if (w.term.toLowerCase() === cleanWord) return true;
          if (w.forms && Array.isArray(w.forms)) {
            return w.forms.some(f => {
              if (typeof f === 'object' && f.word) return f.word.toLowerCase() === cleanWord;
              if (typeof f === 'string') return f.toLowerCase() === cleanWord;
              return false;
            });
          }
          if (typeof w.forms === 'string') {
            return w.forms.toLowerCase().split(';').map(s=>s.trim()).includes(cleanWord);
          }
          return false;
        });

        if (existing) {
          return `<span class="word-token known-word" data-word="${escapeHtml(match)}" data-id="${existing.id}" title="${escapeHtml(existing.definition)}">${escapeHtml(match)}</span>`;
        }
        return `<span class="word-token unknown-word" data-word="${escapeHtml(match)}">${escapeHtml(match)}</span>`;
      });
    }

    window.jumpToCard = function(wordId) {
      closePanel();
      const targetWord = State.words.find(w => w.id === wordId);
      if (!targetWord) return;

      State.currentCategory = targetWord.category;
      document.getElementById('categoryFilter').value = targetWord.category;
      State.studyMode = "ALL";
      document.getElementById('studyModeFilter').value = "ALL";

      const deck = getActiveDeck();
      const index = deck.findIndex(w => w.id === wordId);

      if (index !== -1) {
        State.currentCardIndex = index;
        State.lastAction = null; 
        switchTab("cardsView");
        renderFlashcard();
      }
    };

    function getTextPrompt(term, contextSentence = "") {
      const currentCats = getUniqueCategories().join(', ');
      let contextBlock = contextSentence ? `в контексте: "${contextSentence}".` : ``;
      
      return `Ты лексикограф. Пользователь запросил слово/фразу: "${term}" ${contextBlock}
Приведи к БАЗОВОЙ словарной форме (Infinitive, Nominative). НЕ МЕНЯЙ часть речи.
Правила:
1. Переведи ИМЕННО то слово/фразу, на которое кликнули/ввели. В поле definition пиши ТОЛЬКО чистый словарный перевод. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНЫ мета-пояснения.
2. РЕГИСТР: ПЕРВАЯ буква базовой формы (term) и каждой словоформы в массиве forms ВСЕГДА должна быть ЗАГЛАВНОЙ (большой). Остальные слова внутри фразы — по правилам (имена собственные с большой, остальные с маленькой). Удали дубликаты.
3. Категория: оцени сложность -> "English A1", "English B2" и тд. Если латынь - "Латынь". Иначе - выбери из [${currentCats}].
4. ЯЗЫКОВЫЕ ПРАВИЛА (СМОТРИ НА АЛФАВИТ):
   - Если сам термин написан КИРИЛЛИЦЕЙ (русский язык): в definition дай ТОЛКОВАНИЕ. Поля transcription, forms и exampleTranslation оставь ПУСТЫМИ.
   - Если термин написан ЛАТИНИЦЕЙ: заполни ВСЕ поля, включая транскрипцию. Для латыни обязательно пиши формы (склонения/спряжения), ЕСЛИ это отдельное слово. Если термин - это длинная устойчивая фраза/максима, массив forms оставь ПУСТЫМ []. В поле "word" внутри "forms" пиши ТОЛЬКО иностранное слово.
Верни ИСКЛЮЧИТЕЛЬНО JSON:
{"term": "базовая форма", "transcription": "[...]", "forms": [{"word": "иностранная_форма", "translation": "перевод", "transcription": "[...]"}], "definition": "чистый перевод", "example": "исходное или новое предложение", "exampleTranslation": "перевод предложения", "category": "категория"}`;
    }


    async function openWordPanel(word, contextSentence, category) {
      document.getElementById("wpTerm").textContent = word;
      document.getElementById("wpContent").innerHTML = `<div class="bs-loader">🤖 Нейросеть анализирует контекст...</div>`;
      wpAddBtn.style.display = "none";
      bsOverlay.classList.add("show");
      wordPanel.classList.add("show");

      try {
        const prompt = getTextPrompt(word, contextSentence);
        const data = await callGeminiAPI(prompt, null, (current, total) => {
          document.getElementById("wpContent").innerHTML = `<div class="bs-loader">🔄 Смена ключа (${current}/${total})...</div>`;
        });

        const jsonMatch = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Ошибка парсинга ответа ИИ");

        const parsed = JSON.parse(jsonMatch[0]);
        State.pendingWordData = {
          id: "w-" + Date.now(), 
          term: parsed.term || word, 
          transcription: parsed.transcription || "",
          forms: parsed.forms || [], 
          definition: parsed.definition || "Определение не найдено",
          example: parsed.example || contextSentence, 
          exampleTranslation: parsed.exampleTranslation || "", 
          category: parsed.category || "English"
        };

        let bsForms = "";
        if (Array.isArray(State.pendingWordData.forms) && State.pendingWordData.forms.length > 0) {
          bsForms = State.pendingWordData.forms.map(f => 
            typeof f === 'object' && f.word ? 
            `<div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
               <b>${escapeHtml(f.word)}</b> 
               <span style="color:var(--text-muted); font-size:0.85rem;">${escapeHtml(f.transcription || '')}</span>
               <button type="button" class="speak-btn mini form-speak-btn" data-word="${escapeHtml(f.word)}">🔊</button>
               ${f.translation ? `<span>— ${escapeHtml(f.translation)}</span>` : ''}
             </div>` : f
          ).join("");
        }

        document.getElementById("wpTerm").innerHTML = `${escapeHtml(State.pendingWordData.term)} <span style="font-size: 1.1rem; color: var(--text-muted); font-weight: normal; margin-left: 6px;">${escapeHtml(State.pendingWordData.transcription)}</span>`;
        
        document.getElementById("wpContent").innerHTML = `
          <div style="font-weight:600; font-size:1.2rem; color:var(--text-main); margin-bottom:8px;">${escapeHtml(State.pendingWordData.definition)}</div>
          <div class="bs-meta">
            <strong>Предмет:</strong> <span class="badge" style="margin:0;">${escapeHtml(State.pendingWordData.category)}</span><br>
            ${bsForms ? `<div style="margin-top: 8px; line-height: 1.4;"><strong>Формы:</strong><br>${bsForms}</div>` : ''}
          </div>
        `;

        document.querySelectorAll("#wpContent .form-speak-btn").forEach(btn => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            speak(btn.dataset.word, State.pendingWordData.category);
          });
        });

        wpAddBtn.style.display = "block";

      } catch (err) {
        if (err.message.startsWith("QUOTA_EXHAUSTED")) {
            let waitSec = parseRetrySeconds(err.message.split("|")[1]);
            document.getElementById("wpContent").innerHTML = `
              <div style="color:var(--accent); text-align: center; padding: 12px 0; line-height: 1.5;">
                ⏳ <strong>Все ключи остывают</strong><br>
                <span style="font-size: 0.85rem; color:var(--text-muted);">
                  Сервер просит подождать: <strong>${waitSec} сек.</strong>
                </span>
              </div>
            `;
        } else if (err.message === "NO_API_KEY") {
            document.getElementById("wpContent").innerHTML = `<div style="color:var(--danger)">❌ Укажите API ключ во вкладке «Добавить»</div>`;
        } else {
            document.getElementById("wpContent").innerHTML = `<div style="color:var(--danger)">❌ Ошибка: ${err.message}</div>`;
        }
      }
    }

    wpAddBtn.addEventListener("click", () => {
      if (State.pendingWordData) {
        const existing = State.words.find(w => w.term.toLowerCase() === State.pendingWordData.term.toLowerCase());
        if (existing) {
          showToast("⚠️ Это слово/термин уже в словаре!");
          jumpToCard(existing.id);
          State.pendingWordData = null;
          return;
        }

        State.words.unshift(State.pendingWordData);
        Storage.setWords(State.words);
        State.currentCategory = "ALL";
        document.getElementById("categoryFilter").value = "ALL";
        updateCategoryUI();
        renderDictionary();
        renderFlashcard();
        showToast(`✅ Слово «${State.pendingWordData.term}» добавлено в словарь!`);
        closePanel();
        State.pendingWordData = null;
      }
    });

    function getUniqueCategories() {
      const categories = State.words.map(w => w.category);
      return [...new Set(categories)].sort();
    }

    function updateCategoryUI() {
      const uniqueCategories = getUniqueCategories();
      const filterSelect = document.getElementById('categoryFilter');
      const currentFilterValue = filterSelect.value;
      filterSelect.innerHTML = '<option value="ALL">Все предметы</option>';
      uniqueCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat; option.textContent = cat;
        filterSelect.appendChild(option);
      });
      filterSelect.value = (uniqueCategories.includes(currentFilterValue) || currentFilterValue === 'ALL') ? currentFilterValue : 'ALL';
      if (filterSelect.value === 'ALL') State.currentCategory = 'ALL';
      let datalist = document.getElementById('dynamicCategoriesList');
      if (!datalist) {
        datalist = document.createElement('datalist'); datalist.id = 'dynamicCategoriesList'; document.body.appendChild(datalist);
      }
      datalist.innerHTML = '';
      uniqueCategories.forEach(cat => {
        const option = document.createElement('option'); option.value = cat; datalist.appendChild(option);
      });
    }

    const importToggleBtn = document.getElementById("importToggleBtn");
    const importTextarea = document.getElementById("importTextarea");

    importToggleBtn.addEventListener("click", () => {
      if (importTextarea.style.display === "none" || importTextarea.style.display === "") {
        importTextarea.style.display = "block";
        importToggleBtn.textContent = "✅ Сохранить импорт";
        importToggleBtn.style.backgroundColor = "var(--card-bg)";
      } else {
        const val = importTextarea.value.trim();
        if (val) {
          try {
            const arr = JSON.parse(val);
            if (Array.isArray(arr)) {
              arr.forEach(w => {
                if(!w.id) w.id = "w-" + Math.random().toString(36).substr(2, 9);
                if(!w.forms) w.forms = []; 
                State.words.unshift(w);
              });
              Storage.setWords(State.words);
              State.currentCategory = "ALL";
              document.getElementById("categoryFilter").value = "ALL";
              updateCategoryUI(); renderDictionary(); renderFlashcard();
              showToast(`📥 Успешно импортировано слов: ${arr.length}`);
              importTextarea.value = "";
            } else {
              alert("Ошибка: Ожидается JSON массив объектов.");
              return;
            }
          } catch(e) { alert("Неверный формат JSON: " + e.message); return; }
        }
        importTextarea.style.display = "none";
        importToggleBtn.textContent = "📂 Импорт JSON";
        importToggleBtn.style.backgroundColor = "transparent";
      }
    });

    const flashcardHost = document.getElementById("flashcardHost");
    const srsControls = document.getElementById("srsControls");
    const undoBtn = document.getElementById("undoBtn");

    function updateUndoButton() { undoBtn.style.display = State.lastAction ? "inline-block" : "none"; }

function renderFlashcard() {
  // КЛАССИЧЕСКИЙ РЕЖИМ (КАРТОЧКИ)
  if (State.flashcardMode !== "TEST") {
    const deck = getActiveDeck();
    State.isFlipped = false;
    updateUndoButton();

    if (deck.length === 0) {
      srsControls.style.display = "none";
      flashcardHost.innerHTML = `
        <div class="empty-state">
          <p style="font-size: 1.1rem; font-weight: 600; color: var(--accent); margin-bottom: 6px;">Колода пуста</p>
          <p style="font-size: 0.85rem; color: var(--text-muted);">${State.studyMode === "DUE" ? "🎉 Все карточки на сегодня повторены!" : "В этой категории пока нет карточек."}</p>
        </div>
      `;
      return;
    }

    srsControls.style.display = "grid";
    if (State.currentCardIndex >= deck.length) State.currentCardIndex = 0;
    const item = deck[State.currentCardIndex];

    const isLatin = item.category.toLowerCase().includes("латын") || item.category.toLowerCase().includes("latin") || item.category.toLowerCase().includes("римское");
    const hasCyrillicExample = /[а-яА-ЯЁё]/.test(item.example);
    const shouldTokenize = !isLatin || !hasCyrillicExample;
    const renderedExample = shouldTokenize ? tokenizeExample(item.example) : escapeHtml(item.example);

    let formsHtml = "";
    const hasForms = item.forms && ((Array.isArray(item.forms) && item.forms.length > 0) || (typeof item.forms === 'string' && item.forms.trim() !== ''));
    if (hasForms) {
      if (Array.isArray(item.forms)) {
        formsHtml = item.forms.map(f => {
          if (typeof f === 'object' && f.word) {
            return `<div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;"><b>${escapeHtml(f.word)}</b> <span style="color:var(--text-muted); font-size:0.85rem;">${escapeHtml(f.transcription || '')}</span><button type="button" class="speak-btn mini form-speak-btn" data-word="${escapeHtml(f.word)}">🔊</button>${f.translation ? `<span>— ${escapeHtml(f.translation)}</span>` : ''}</div>`;
          } return escapeHtml(f);
        }).join("");
      } else { formsHtml = escapeHtml(item.forms); }
    }

    const backFaceHtml = `
      <div class="card-face back">
        <span class="badge">${escapeHtml(item.category)}</span>
        
        <div class="term-wrapper" style="margin-bottom: 8px;">
          <strong style="color: var(--accent); font-size: 1.2rem;">${escapeHtml(item.term)}</strong> 
          <span style="color: var(--text-muted); font-size: 1rem; font-weight: normal; margin-left: 6px;">${escapeHtml(item.transcription || '')}</span>
          <button type="button" class="speak-btn mini" id="backSpeakTermBtn" title="Озвучить термин" style="margin-left: 8px;">🔊</button>
        </div>
        
        <div style="display: flex; gap: 12px; width: 100%; align-items: flex-start; background: rgba(11, 19, 43, 0.3); padding: 12px; border-radius: 8px; border-left: 3px solid var(--card-border);">
            <div class="definition-text" style="flex: 1; font-size: 1.1rem;">${escapeHtml(item.definition)}</div>
            <button type="button" class="speak-btn mini" id="backSpeakDefBtn" title="Озвучить перевод" style="flex-shrink: 0;">🔊</button>
        </div>

        ${hasForms ? `<div style="width: 100%; margin-top: 12px; border-left: 2px solid var(--card-border); padding-left: 12px;"><button type="button" class="translation-toggle-btn" id="toggleFormsBtn">👁️ Показать формы</button><div class="example-translation-block" id="formsBlock">${formsHtml}</div></div>` : ''}
        ${item.example ? `<div class="meta-block" style="margin-top: 12px;"><div class="example-header"><strong>Пример:</strong><button type="button" class="speak-btn mini" id="exampleSpeakBtn">🔊</button></div><div class="example-text" id="exampleTokensContainer">${renderedExample}</div>${item.exampleTranslation ? `<button type="button" class="translation-toggle-btn" id="toggleTransBtn">👁️ Показать перевод</button><div class="example-translation-block" id="exampleTranslationBlock">${escapeHtml(item.exampleTranslation)}</div>` : ''}</div>` : ''}
      </div>
    `;

    flashcardHost.innerHTML = `
      <div class="flashcard-container can-flip" id="activeCard">
        <div class="flashcard" id="activeCardInner">
          <div class="card-face front">
            <span class="badge">${escapeHtml(item.category)}</span>
            <div class="term-wrapper">
              <div class="term-title">${escapeHtml(item.term)} <span style="color: var(--text-muted); font-size: 1.2rem; font-weight: normal; margin-left: 4px;">${escapeHtml(item.transcription || '')}</span></div>
              <button type="button" class="speak-btn" id="frontSpeakBtn">🔊</button>
            </div>
          </div>
          ${backFaceHtml}
        </div>
      </div>
    `;

    const card = document.getElementById("activeCard");
    const cardInner = document.getElementById("activeCardInner");
    
    card.addEventListener("click", (e) => {
      if (e.target.closest('button') || e.target.closest('.word-token')) return;
      if (!card.classList.contains("can-flip")) return; 
      
      State.isFlipped = !State.isFlipped;
      cardInner.classList.toggle("flipped", State.isFlipped);
      
      // Умная авто-озвучка в обе стороны
      if (State.ttsAuto) {
        if (State.isFlipped) {
          // Если перевернули на изнанку — читаем перевод
          speak(item.definition, item.category);
        } else {
          // Если вернули обратно на лицевую — снова читаем термин
          speak(item.term, item.category);
        }
      }
    });
    
    document.getElementById("frontSpeakBtn").addEventListener("click", (e) => { e.stopPropagation(); speak(item.term, item.category); });
    
    document.getElementById("backSpeakTermBtn").addEventListener("click", (e) => { e.stopPropagation(); speak(item.term, item.category); });
    document.getElementById("backSpeakDefBtn").addEventListener("click", (e) => { e.stopPropagation(); speak(item.definition, item.category); });
    
    if (document.getElementById("exampleSpeakBtn")) document.getElementById("exampleSpeakBtn").addEventListener("click", (e) => { e.stopPropagation(); speak(item.example, item.category); });
    document.querySelectorAll(".form-speak-btn").forEach(btn => { btn.addEventListener("click", (e) => { e.stopPropagation(); speak(btn.dataset.word, item.category); }); });
    const transBtn = document.getElementById("toggleTransBtn");
    if (transBtn) transBtn.addEventListener("click", (e) => { e.stopPropagation(); const isShown = document.getElementById("exampleTranslationBlock").classList.toggle("visible"); transBtn.textContent = isShown ? "🙈 Скрыть перевод" : "👁️ Показать перевод"; });
    const formsBtn = document.getElementById("toggleFormsBtn");
    if (formsBtn) formsBtn.addEventListener("click", (e) => { e.stopPropagation(); const isShown = document.getElementById("formsBlock").classList.toggle("visible"); formsBtn.textContent = isShown ? "🙈 Скрыть формы" : "👁️ Показать формы"; });
    const tokensContainer = document.getElementById("exampleTokensContainer");
    if (tokensContainer) tokensContainer.querySelectorAll(".word-token").forEach(token => { token.addEventListener("click", (e) => { e.stopPropagation(); const word = token.dataset.word; speak(word, item.category); token.classList.contains("known-word") ? jumpToCard(token.dataset.id) : openWordPanel(word, item.example, item.category); }); });
    
    if (State.ttsAuto && !State.isFlipped) {
        setTimeout(() => speak(item.term, item.category), 100);
    }
    
    return; 
  }

  // РЕЖИМ ТЕСТОВ
  srsControls.style.display = "none";
  updateUndoButton(); 

  if (!State.testSession) {
    let pool = getFilteredWords();
    if (pool.length === 0) {
      flashcardHost.innerHTML = `<div class="empty-state"><p style="font-size: 1.1rem; font-weight: 600; color: var(--accent);">Нет слов для теста</p></div>`;
      return;
    }
    const order = document.getElementById("testOrderSelect") ? document.getElementById("testOrderSelect").value : "RANDOM";
    let finalDeck = order === "SEQUENTIAL" ? [...pool].sort((a, b) => a.term.localeCompare(b.term, undefined, {numeric: true, sensitivity: 'base'})) : shuffleArray(pool);
    State.testSession = { deck: finalDeck, index: 0, correct: 0, mistakes: [], startTime: Date.now() };
  }

  const session = State.testSession;

  if (session.index >= session.deck.length) {
    if (window.testTimerInterval) clearInterval(window.testTimerInterval);
    
    const percent = Math.round((session.correct / session.deck.length) * 100);
    const diffSec = Math.floor((Date.now() - session.startTime) / 1000);
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    const timeStr = mins > 0 ? `${mins} мин ${secs} сек` : `${secs} сек`;

    let mistakesHtml = "";
    if (session.mistakes.length > 0) {
      mistakesHtml = `
        <div class="mistakes-list">
          <h4 style="color: var(--text-main); margin-bottom: 12px;">Ошибки (${session.mistakes.length}):</h4>
          ${session.mistakes.map(m => `
            <div class="mistake-item">
              <div class="mistake-term">${escapeHtml(m.term)}</div>
              <div class="mistake-def">${escapeHtml(m.definition)}</div>
            </div>
          `).join("")}
        </div>
      `;
    }

    flashcardHost.innerHTML = `
      <div class="flashcard" style="min-height: auto;">
        <div class="test-results">
          <h2>🎉 Тест завершен!</h2>
          <div class="score-circle" style="border-color: ${percent >= 80 ? '#2a9d8f' : (percent >= 50 ? 'var(--accent)' : 'var(--danger)')}; color: ${percent >= 80 ? '#2a9d8f' : (percent >= 50 ? 'var(--accent)' : 'var(--danger)')};">
            ${percent}%
          </div>
          <p style="font-size: 1.1rem; color: var(--text-muted); margin-bottom: 8px;">Верно: <strong style="color:var(--text-main);">${session.correct}</strong> из <strong style="color:var(--text-main);">${session.deck.length}</strong></p>
          <p style="font-size: 1.1rem; color: var(--accent); font-weight: 600;">⏱ Время: ${timeStr}</p>
          ${mistakesHtml}
          <div class="results-actions">
            <button class="btn-secondary" onclick="restartFullTest()">🔁 Начать заново</button>
            ${session.mistakes.length > 0 ? `<button class="btn-primary" onclick="reviewMistakes()">🔥 Проработать ошибки</button>` : ''}
          </div>
        </div>
      </div>
    `;
    return;
  }

  const item = session.deck[session.index];
  const progressPercent = Math.round((session.index / session.deck.length) * 100);
  
  let basePool = State.words.filter(w => w.category === item.category && w.id !== item.id);
  const q = (item.term || "").toLowerCase();
  const a = (item.definition || "").toLowerCase();
  
  const isAuthor = (strQ, strA) => strQ.includes("кому") || strA.includes("философ") || strA.includes("профессор") || strA.includes("судье") || strA.includes("лейбниц") || strA.includes("френд");
  const isList = (strQ, strA) => strQ.includes("вид") || strQ.includes("част") || ((strA.match(/,/g) || []).length >= 1 && strA.length < 150);
  const isFunction = (strQ, strA) => strQ.includes("функци") || strA.includes("функция");

  const currentIsAuthor = isAuthor(q, a);
  const currentIsList = isList(q, a);
  const currentIsFunction = isFunction(q, a);

  let tier1 = basePool.filter(w => {
      const wq = (w.term || "").toLowerCase(); const wa = (w.definition || "").toLowerCase();
      if (currentIsAuthor) return isAuthor(wq, wa);
      if (currentIsFunction) return isFunction(wq, wa);
      if (currentIsList) return isList(wq, wa);
      return !isAuthor(wq, wa) && !isList(wq, wa) && !isFunction(wq, wa);
  });

  let tier2 = basePool.filter(w => {
      const wq = (w.term || "").toLowerCase(); const wa = (w.definition || "").toLowerCase();
      if (!currentIsAuthor && isAuthor(wq, wa)) return false; 
      if (!currentIsList && isList(wq, wa)) return false;     
      return true;
  });

  let pool = tier1.length >= 3 ? tier1 : (tier2.length >= 3 ? tier2 : basePool);
  if (pool.length < 3) pool = State.words.filter(w => w.id !== item.id);
  
  const shuffledPool = shuffleArray(pool);
  const wrongOptions = shuffledPool.slice(0, 3).map(w => w.definition);
  const options = shuffleArray([...wrongOptions, item.definition]);

  const optionsHtml = options.map(opt => {
      const isCorrect = opt === item.definition;
      return `<button type="button" class="test-option-btn" data-correct="${isCorrect}">${escapeHtml(opt)}</button>`;
  }).join("");

  flashcardHost.innerHTML = `
    <div class="test-progress-text" style="display:flex; justify-content:space-between; align-items:flex-end;">
      <span id="liveTimer" style="font-family: monospace; font-size: 1.1rem; color: var(--accent); font-weight:600;">⏱ 00:00</span>
      <span>Вопрос ${session.index + 1} из ${session.deck.length}</span>
    </div>
    <div class="test-progress-bar"><div class="test-progress-fill" style="width: ${progressPercent}%"></div></div>
    
    <div class="flashcard-container" style="cursor: default; margin-top: 0;">
      <div class="flashcard" style="box-shadow: none;">
        <div class="card-face front" style="justify-content: flex-start; padding: 24px 20px;">
          <span class="badge">${escapeHtml(item.category)}</span>
          <div class="term-wrapper" style="margin-bottom: 12px;">
            <div class="term-title">${escapeHtml(item.term)} <span style="color: var(--text-muted); font-size: 1.2rem; font-weight: normal; margin-left: 4px;">${escapeHtml(item.transcription || '')}</span></div>
            <button type="button" class="speak-btn" onclick="speak('${escapeHtml(item.term).replace(/'/g, "\\'")}', '${escapeHtml(item.category).replace(/'/g, "\\'")}')">🔊</button>
          </div>
          <div class="test-options" id="testOptionsContainer">
            ${optionsHtml}
          </div>
        </div>
      </div>
    </div>
  `;

  if (window.testTimerInterval) clearInterval(window.testTimerInterval);
  window.testTimerInterval = setInterval(() => {
      const el = document.getElementById('liveTimer');
      if(el && State.testSession) {
          const diff = Math.floor((Date.now() - State.testSession.startTime) / 1000);
          const m = Math.floor(diff / 60).toString().padStart(2, '0');
          const s = (diff % 60).toString().padStart(2, '0');
          el.textContent = `⏱ ${m}:${s}`;
      }
  }, 1000);

  const container = document.getElementById("testOptionsContainer");
  const buttons = container.querySelectorAll(".test-option-btn");
  
  buttons.forEach(btn => {
      btn.addEventListener("click", (e) => {
          e.stopPropagation(); 
          if (btn.hasAttribute("disabled")) return;
          
          buttons.forEach(b => b.setAttribute("disabled", "true"));
          
          if (btn.dataset.correct === "true") {
              btn.classList.add("correct");
              session.correct++;
              setTimeout(() => { session.index++; renderFlashcard(); }, 800);
          } else {
              btn.classList.add("incorrect");
              buttons.forEach(b => { if (b.dataset.correct === "true") b.classList.add("correct"); });
              session.mistakes.push(item);
              setTimeout(() => { session.index++; renderFlashcard(); }, 2500); 
          }
      });
  });
}
    // Глобальные функции для управления сессиями тестов
    window.restartFullTest = function() {
      State.testSession = null;
      renderFlashcard();
    };

    window.reviewMistakes = function() {
      if (!State.testSession || State.testSession.mistakes.length === 0) return;
      State.testSession = {
        deck: shuffleArray([...State.testSession.mistakes]),
        index: 0,
        correct: 0,
        mistakes: [],
        startTime: Date.now() // Запускаем таймер заново для работы над ошибками
      };
      renderFlashcard();
    };
    function processSRS(daysToAdd) {
      const deck = getActiveDeck();
      if (deck.length === 0) return;
      const currentItem = deck[State.currentCardIndex];
      const nextDate = new Date(); nextDate.setDate(nextDate.getDate() + daysToAdd);

      State.lastAction = { cardId: currentItem.id, prevSrs: State.srs[currentItem.id] ? { ...State.srs[currentItem.id] } : null, prevIndex: State.currentCardIndex };
      State.srs[currentItem.id] = { dueDate: nextDate.toISOString(), interval: daysToAdd };
      Storage.setSRS(State.srs);

      if (State.studyMode === "ALL") {
        State.currentCardIndex = (State.currentCardIndex + 1) % deck.length;
      } else {
        if (State.currentCardIndex >= getActiveDeck().length) State.currentCardIndex = 0;
      }
      renderFlashcard(); renderDictionary();
    }

    document.getElementById("undoBtn").addEventListener("click", () => {
      if (!State.lastAction) return;
      const { cardId, prevSrs, prevIndex } = State.lastAction;
      if (prevSrs) State.srs[cardId] = prevSrs; else delete State.srs[cardId];
      Storage.setSRS(State.srs); State.lastAction = null;
      
      const deck = getActiveDeck();
      const cardPos = deck.findIndex(w => w.id === cardId);
      State.currentCardIndex = cardPos !== -1 ? cardPos : (prevIndex < deck.length ? prevIndex : 0);
      renderFlashcard(); renderDictionary();
    });

    srsControls.querySelectorAll(".srs-btn").forEach(btn => {
      btn.addEventListener("click", (e) => { e.stopPropagation(); processSRS(parseInt(btn.dataset.days, 10)); });
    });

   document.getElementById("flashcardModeSelect").addEventListener("change", (e) => {
      State.testSession = null;
      State.flashcardMode = e.target.value;
      State.currentCardIndex = 0;
      State.lastAction = null;
      
      const orderGroup = document.getElementById("testOrderGroup");
      if (orderGroup) orderGroup.style.display = State.flashcardMode === "TEST" ? "flex" : "none";
      
      renderFlashcard();
    });

    document.getElementById("testOrderSelect").addEventListener("change", () => {
      State.testSession = null;
      renderFlashcard();
    });

    const dictSearchInput = document.getElementById("dictSearch");
    dictSearchInput.addEventListener("input", renderDictionary);

    const dictionaryTbody = document.getElementById("dictionaryTbody");
    function renderDictionary() {
      const query = dictSearchInput.value.trim().toLowerCase();
      
      let filtered = getFilteredWords();
      
      if (query) {
        filtered = filtered.filter(w => 
          w.term.toLowerCase().includes(query) || 
          w.definition.toLowerCase().includes(query) || 
          (w.category && w.category.toLowerCase().includes(query))
        );
      }

      filtered.sort((a, b) => {
        const srsA = State.srs[a.id];
        const srsB = State.srs[b.id];
        const dateA = srsA && srsA.dueDate ? new Date(srsA.dueDate).getTime() : 0;
        const dateB = srsB && srsB.dueDate ? new Date(srsB.dueDate).getTime() : 0;
        if (dateA !== dateB) return dateA - dateB; 
        return a.term.localeCompare(b.term); 
      });

      if (filtered.length === 0) {
        dictionaryTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">Записи отсутствуют</td></tr>`;
        return;
      }
      
      dictionaryTbody.innerHTML = filtered.map(w => `
        <tr>
          <td><strong class="dict-term-link" onclick="jumpToCard('${w.id}')">${escapeHtml(w.term)}</strong></td>
          <td>${escapeHtml(w.definition)}</td>
          <td>${escapeHtml(w.category)}</td>
          <td>${State.srs[w.id] ? formatDate(State.srs[w.id].dueDate) : "Новое"}</td>
          <td>
            <div class="actions">
              <button class="action-btn ai-update" onclick="quickUpdateAI('${w.id}')" title="Авто-обновить через ИИ">✨ ИИ</button>
              <button class="action-btn" onclick="editWord('${w.id}')">Ред.</button>
              <button class="action-btn delete" onclick="deleteWord('${w.id}')">Удал.</button>
            </div>
          </td>
        </tr>
      `).join("");
    }

    window.quickUpdateAI = async function(id) {
      const wordObj = State.words.find(w => w.id === id);
      if (!wordObj) return;

      const keysStr = Storage.getApiKey();
      if (!keysStr) { 
        showToast("❌ Укажите API Key во вкладке Добавить!"); 
        return; 
      }

      const backupWord = JSON.parse(JSON.stringify(wordObj));
      showToast(`⏳ Обновляем «${wordObj.term}»...`);

      try {
        const prompt = getTextPrompt(wordObj.term, wordObj.example);
        const data = await callGeminiAPI(prompt, null);

        const jsonMatch = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("JSON не найден");
        
        const parsed = JSON.parse(jsonMatch[0]);

        wordObj.term = parsed.term || wordObj.term;
        wordObj.transcription = parsed.transcription || "";
        wordObj.forms = parsed.forms || [];
        wordObj.definition = parsed.definition || wordObj.definition;
        wordObj.example = parsed.example || wordObj.example;
        wordObj.exampleTranslation = parsed.exampleTranslation || wordObj.exampleTranslation;
        wordObj.category = parsed.category || wordObj.category;

        State.lastAiUpdate = backupWord;
        document.getElementById("undoDictUpdateBtn").style.display = "inline-block";

        Storage.setWords(State.words);
        renderDictionary();
        
        const deck = getActiveDeck();
        if (deck[State.currentCardIndex] && deck[State.currentCardIndex].id === id) {
           renderFlashcard();
        }
        
        showToast(`✅ Карточка «${wordObj.term}» обновлена!`);
      } catch (err) {
        if (err.message.startsWith("QUOTA_EXHAUSTED")) {
            let waitSec = parseRetrySeconds(err.message.split("|")[1]);
            showToast(`⏳ Лимит! Ждем ${waitSec} сек...`);
        } else {
            showToast(`❌ Ошибка обновления: ${err.message}`);
        }
      }
    };

    const undoDictUpdateBtn = document.getElementById("undoDictUpdateBtn");
    undoDictUpdateBtn.addEventListener("click", () => {
      if (!State.lastAiUpdate) return;
      const index = State.words.findIndex(w => w.id === State.lastAiUpdate.id);
      if (index !== -1) {
        State.words[index] = State.lastAiUpdate;
        Storage.setWords(State.words);
        State.lastAiUpdate = null;
        undoDictUpdateBtn.style.display = "none";
        renderDictionary();
        
        const deck = getActiveDeck();
        if (deck[State.currentCardIndex] && deck[State.currentCardIndex].id === State.words[index].id) {
           renderFlashcard();
        }
        
        showToast("✅ Откат успешно выполнен (без затрат ИИ)!");
      }
    });

    window.deleteWord = function(id) {
      State.words = State.words.filter(w => w.id !== id);
      delete State.srs[id];
      if (State.lastAction && State.lastAction.cardId === id) State.lastAction = null;
      Storage.setWords(State.words); Storage.setSRS(State.srs);
      updateCategoryUI(); renderDictionary(); renderFlashcard();
    };

    window.editWord = function(id) {
      const word = State.words.find(w => w.id === id);
      if (!word) return;
      document.getElementById("editWordId").value = word.id;
      document.getElementById("formTerm").value = word.term;
      document.getElementById("formTranscription").value = word.transcription || "";
      
      let formsStr = "";
      if (Array.isArray(word.forms)) {
        formsStr = word.forms.map(f => {
          if (typeof f === 'object' && f.word) {
            return `${f.word}${f.transcription ? ' [' + f.transcription.replace(/\[|\]/g, '') + ']' : ''}${f.translation ? ' - ' + f.translation : ''}`;
          }
          return f;
        }).join("; ");
      } else {
        formsStr = word.forms || "";
      }
      document.getElementById("formForms").value = formsStr;
      
      document.getElementById("formDefinition").value = word.definition;
      document.getElementById("formExample").value = word.example || "";
      document.getElementById("formExampleTranslation").value = word.exampleTranslation || "";
      document.getElementById("formCategory").value = word.category;
      document.getElementById("formSubmitBtn").textContent = "Обновить";
      document.getElementById("formCancelBtn").style.display = "inline-block";
      switchTab("addView");
    };

    const wordForm = document.getElementById("wordForm");
    const formCancelBtn = document.getElementById("formCancelBtn");

    function resetForm() {
      wordForm.reset(); document.getElementById("editWordId").value = "";
      document.getElementById("formSubmitBtn").textContent = "Сохранить"; formCancelBtn.style.display = "none";
    }

    formCancelBtn.addEventListener("click", () => { resetForm(); switchTab("dictionaryView"); });

    wordForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const editId = document.getElementById("editWordId").value;
      const term = document.getElementById("formTerm").value.trim(); 

      const existingWord = State.words.find(w => w.term.toLowerCase() === term.toLowerCase() && w.id !== editId);
      if (existingWord) {
        showToast("⚠️ Это слово/термин уже в словаре!");
        jumpToCard(existingWord.id);
        return; 
      }

      const transcription = document.getElementById("formTranscription").value.trim();
      
      const formsStr = document.getElementById("formForms").value.trim();
      const forms = formsStr ? formsStr.split(';').map(s => {
        let word = "", translation = "", trans = "";
        const transMatch = s.match(/\[(.*?)\]/);
        if (transMatch) {
          trans = `[${transMatch[1]}]`;
          s = s.replace(transMatch[0], '').trim();
        }
        if (s.includes('-')) {
          const parts = s.split('-');
          word = parts[0].trim();
          translation = parts.slice(1).join('-').trim();
        } else {
          word = s.trim();
        }
        return { word, translation, transcription: trans };
      }).filter(f => f.word) : [];

      const definition = document.getElementById("formDefinition").value.trim();
      const example = document.getElementById("formExample").value.trim();
      const exampleTranslation = document.getElementById("formExampleTranslation").value.trim();
      
      let rawCat = document.getElementById("formCategory").value.trim();
      if (!term || !definition || !rawCat) return;
      
      const category = getUniqueCategories().find(c => c.toLowerCase() === rawCat.toLowerCase()) || (rawCat.charAt(0).toUpperCase() + rawCat.slice(1));

      if (editId) {
        State.words = State.words.map(w => w.id === editId ? { ...w, term, transcription, forms, definition, example, exampleTranslation, category } : w);
      } else {
        State.words.unshift({ id: "w-" + Date.now(), term, transcription, forms, definition, example, exampleTranslation, category });
      }

      Storage.setWords(State.words); resetForm();
      State.currentCategory = "ALL";
      document.getElementById("categoryFilter").value = "ALL";
      updateCategoryUI(); renderDictionary(); renderFlashcard(); switchTab("dictionaryView");
    });

    const aiFillBtn = document.getElementById("aiFillBtn");
    aiFillBtn.addEventListener("click", async () => {
      const term = document.getElementById("formTerm").value.trim();
      if (!term) {
        showToast("⚠️ Сначала введите слово в поле «Термин»!");
        document.getElementById("formTerm").focus();
        return;
      }
      
      const keysStr = Storage.getApiKey();
      if (!keysStr) {
        showToast("❌ Укажите API Key выше!");
        return;
      }

      const originalText = aiFillBtn.innerHTML;
      aiFillBtn.innerHTML = "⏳ ИИ...";
      aiFillBtn.disabled = true;

      try {
        const prompt = getTextPrompt(term);
        const data = await callGeminiAPI(prompt, null, (current, total) => {
           aiFillBtn.innerHTML = `⏳ ${current}/${total}`;
        });

        const jsonMatch = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("JSON не найден");

        const parsed = JSON.parse(jsonMatch[0]);
        document.getElementById("formTerm").value = parsed.term || term;
        document.getElementById("formTranscription").value = parsed.transcription || "";
        
        let formsStr = "";
        if (Array.isArray(parsed.forms)) {
          formsStr = parsed.forms.map(f => {
            if (typeof f === 'object' && f.word) {
              return `${f.word}${f.transcription ? ' [' + f.transcription.replace(/\[|\]/g, '') + ']' : ''}${f.translation ? ' - ' + f.translation : ''}`;
            }
            return f;
          }).join("; ");
        }
        document.getElementById("formForms").value = formsStr;
        
        document.getElementById("formDefinition").value = parsed.definition || "";
        document.getElementById("formExample").value = parsed.example || "";
        document.getElementById("formExampleTranslation").value = parsed.exampleTranslation || "";
        if (parsed.category) document.getElementById("formCategory").value = parsed.category;

        showToast("✨ Поля успешно заполнены ИИ!");
      } catch (err) {
        if (err.message.startsWith("QUOTA_EXHAUSTED")) {
            let waitSec = parseRetrySeconds(err.message.split("|")[1]);
            showToast(`⏳ Лимит! Ждем ${waitSec} сек...`);
        } else if (err.message === "NO_API_KEY") {
            showToast("❌ Укажите API ключи в поле выше");
        } else {
            showToast(`❌ Ошибка: ${err.message}`);
        }
      } finally {
        aiFillBtn.innerHTML = originalText;
        aiFillBtn.disabled = false;
      }
    });

    document.querySelectorAll(".tab-btn[data-tab]").forEach(btn => {
      btn.addEventListener("click", () => { if (btn.id === "navAddBtn") resetForm(); switchTab(btn.dataset.tab); });
    });

    function switchTab(targetTabId) {
      document.querySelectorAll(".tab-btn[data-tab]").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === targetTabId));
      document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === targetTabId));
    }

    document.getElementById("ttsAutoToggle").addEventListener("click", (e) => {
      State.ttsAuto = !State.ttsAuto; Storage.setTtsAuto(State.ttsAuto);
      e.target.classList.toggle("active", State.ttsAuto);
      e.target.textContent = State.ttsAuto ? "🔊 Авто: Вкл" : "🔈 Авто: Выкл";
    });

    document.getElementById("ttsSpeedSelect").value = State.ttsSpeed.toString();
    document.getElementById("ttsSpeedSelect").addEventListener("change", (e) => {
      State.ttsSpeed = parseFloat(e.target.value); Storage.setTtsSpeed(State.ttsSpeed);
    });

    document.getElementById("categoryFilter").addEventListener("change", (e) => {
      State.currentCategory = e.target.value; State.currentCardIndex = 0; State.lastAction = null;
      State.testSession = null;
      renderFlashcard(); renderDictionary();
    });

    document.getElementById("studyModeFilter").addEventListener("change", (e) => {
      State.studyMode = e.target.value; State.currentCardIndex = 0; State.lastAction = null;
      renderFlashcard();
    });

    function escapeHtml(str) { return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }

    const recordBtn = document.getElementById("recordBtn");
    const voiceStatus = document.getElementById("voiceStatus");

    let mediaRecorder = null; let audioChunks = []; let audioStream = null; let isProcessing = false;

    function blobToBase64(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject; reader.readAsDataURL(blob);
      });
    }

    async function startRecording() {
      if (isProcessing) return;
      if (!Storage.getApiKey()) return voiceStatus.textContent = "❌ Укажите API Key";

      try {
        audioChunks = []; audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : (MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "");
        mediaRecorder = mimeType ? new MediaRecorder(audioStream, { mimeType }) : new MediaRecorder(audioStream);

        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = handleRecordingComplete; mediaRecorder.start();
        
        recordBtn.classList.add("recording"); recordBtn.textContent = "🔴 Говорите..."; voiceStatus.textContent = "🎙️ Запись...";
      } catch (err) { voiceStatus.textContent = "❌ Ошибка микрофона"; }
    }

    function stopRecording() {
      if (!mediaRecorder || mediaRecorder.state === "inactive") return;
      recordBtn.classList.remove("recording"); recordBtn.textContent = "🎤 Нажми и говори (Полное ИИ-распознавание)"; mediaRecorder.stop();
    }

    async function handleRecordingComplete() {
      if (audioStream) { audioStream.getTracks().forEach(t => t.stop()); audioStream = null; }
      if (audioChunks.length === 0) return voiceStatus.textContent = "Ожидание...";
      const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || "audio/webm" });
      if (audioBlob.size < 2000) return voiceStatus.textContent = "Слишком коротко";
      await sendAudioToGemini(audioBlob);
    }

    async function sendAudioToGemini(blob) {
      isProcessing = true; recordBtn.disabled = true; voiceStatus.textContent = "🤖 Распознавание...";
      try {
        const base64Audio = await blobToBase64(blob);
        const currentCats = getUniqueCategories().join(', ');
        
        const prompt = `Ты лексикограф словаря. Выслушай аудио. 
Извлеки термин (ЭТО МОЖЕТ БЫТЬ КАК ОДНО СЛОВО, ТАК И СЛОВОСОЧЕТАНИЕ ИЛИ ИДИОМА). Приведи к БАЗОВОЙ форме (не меняй часть речи!).
Правила:
1. В поле definition пиши ТОЛЬКО чистый словарный перевод. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНЫ мета-пояснения.
2. РЕГИСТР: ПЕРВАЯ буква базовой формы (term) и каждой словоформы в массиве forms ВСЕГДА должна быть ЗАГЛАВНОЙ (большой). Остальные слова внутри фразы — по правилам (имена собственные с большой, остальные с маленькой). Удали дубликаты.
3. Категория: оцени сложность -> "English A1", "English B2" и т.д. Если латынь — "Латынь". Иначе выбери из [${currentCats}] или придумай.
4. Составь 1 НОВЫЙ емкий пример.
5. ЯЗЫКОВЫЕ ПРАВИЛА:
   - Если сам термин написан КИРИЛЛИЦЕЙ: в definition дай ТОЛКОВАНИЕ. Поля transcription, forms и exampleTranslation оставь пустыми.
   - Если термин написан ЛАТИНИЦЕЙ: заполни ВСЕ поля. В поле "word" внутри "forms" пиши ТОЛЬКО иностранное слово.
Верни ИСКЛЮЧИТЕЛЬНО JSON:
{"term": "базовая форма", "transcription": "[...]", "forms": [{"word": "иностранная_форма", "translation": "перевод", "transcription": "[...]"}], "definition": "толкование", "example": "...", "exampleTranslation": "...", "category": "..."}`;

        const audioPart = { inlineData: { mimeType: blob.type.split(";")[0], data: base64Audio } };
        
        const data = await callGeminiAPI(prompt, audioPart, (current, total) => {
           voiceStatus.textContent = `🔄 Смена ключа (${current}/${total})...`;
        });

        const jsonMatch = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("JSON не найден");

        const parsed = JSON.parse(jsonMatch[0]);
        document.getElementById("formTerm").value = parsed.term || "";
        document.getElementById("formTranscription").value = parsed.transcription || "";
        
        let formsStr = "";
        if (Array.isArray(parsed.forms)) {
          formsStr = parsed.forms.map(f => {
            if (typeof f === 'object' && f.word) {
              return `${f.word}${f.transcription ? ' [' + f.transcription.replace(/\[|\]/g, '') + ']' : ''}${f.translation ? ' - ' + f.translation : ''}`;
            }
            return f;
          }).join("; ");
        }
        document.getElementById("formForms").value = formsStr;
        
        document.getElementById("formDefinition").value = parsed.definition || "";
        document.getElementById("formExample").value = parsed.example || "";
        document.getElementById("formExampleTranslation").value = parsed.exampleTranslation || "";
        if (parsed.category) document.getElementById("formCategory").value = parsed.category;

        voiceStatus.textContent = "✅ Проверьте данные и нажмите «Сохранить»";
        isProcessing = false; recordBtn.disabled = false;
      } catch (err) { 
        if (err.message.startsWith("QUOTA_EXHAUSTED")) {
            let waitSec = parseRetrySeconds(err.message.split("|")[1]);
            const timer = setInterval(() => {
              voiceStatus.textContent = `⏳ Все ключи остывают: ${waitSec} сек...`;
              waitSec--;
              if (waitSec < 0) {
                clearInterval(timer);
                isProcessing = false;
                recordBtn.disabled = false;
                voiceStatus.textContent = "✅ Готов к записи. Нажмите и говорите.";
              }
            }, 1000);
        } else if (err.message === "NO_API_KEY") {
            voiceStatus.textContent = "❌ Укажите API ключи в поле выше"; 
            isProcessing = false; recordBtn.disabled = false;
        } else {
            voiceStatus.textContent = `❌ Ошибка: ${err.message}`; 
            isProcessing = false; recordBtn.disabled = false;
        }
      }
    }

    recordBtn.addEventListener("mousedown", (e) => { e.preventDefault(); startRecording(); });
    recordBtn.addEventListener("mouseup", (e) => { e.preventDefault(); stopRecording(); });
    recordBtn.addEventListener("mouseleave", stopRecording);
    recordBtn.addEventListener("touchstart", (e) => { e.preventDefault(); startRecording(); });
    recordBtn.addEventListener("touchend", (e) => { e.preventDefault(); stopRecording(); });
    recordBtn.addEventListener("touchcancel", (e) => { e.preventDefault(); stopRecording(); });

    // --- Массовая генерация карточек и тестов через ИИ (от 1 до 100+ вопросов) ---
window.generateBatchCards = async function() {
  const subjectInput = document.getElementById("ai-subject-name");
  const rawTextInput = document.getElementById("ai-raw-text");
  const batchBtn = document.getElementById("aiBatchBtn");

  const category = subjectInput.value.trim();
  const rawText = rawTextInput.value.trim();

  if (!category) {
    showToast("⚠️ Укажите название предмета или темы!");
    subjectInput.focus();
    return;
  }
  if (!rawText) {
    showToast("⚠️ Вставьте сырой текст, вопросы или список тезисов!");
    rawTextInput.focus();
    return;
  }

  const keysStr = Storage.getApiKey();
  if (!keysStr) {
    showToast("❌ Укажите API Key в пуле ключей ниже!");
    return;
  }

  const originalText = batchBtn.innerHTML;
  batchBtn.innerHTML = "⏳ ИИ обрабатывает пачку...";
  batchBtn.disabled = true;

  try {
    const prompt = `Ты профессиональный методист и составитель учебных карточек. 
Пользователь передал тебе сырой текст (список вопросов, лекцию, конспект или тезисы, от 1 до 100+ пунктов) для предмета "${category}".
Твоя задача — проанализировать текст, выделить все ключевые вопросы, термины или понятия и составить из них качественные учебные карточки.

Правила формирования JSON:
1. Верни ИСКЛЮЧИТЕЛЬНО валидный JSON-массив объектов (без лишнего текста, без markdown-оберток вроде \`\`\`json, только чистый массив [...] ).
2. Каждый объект в массиве должен содержать поля:
   - "term": "Вопрос или термин (кратко и четко)",
   - "transcription": "",
   - "forms": [],
   - "definition": "Точный, емкий ответ на вопрос или определение термина",
   - "example": "",
   - "exampleTranslation": "",
   - "category": "${category}"
3. Обработай ВСЕ пункты из текста целиком, не пропуская материал.

Исходный текст для обработки:
${rawText}`;

    const data = await callGeminiAPI(prompt, null, (current, total) => {
      batchBtn.innerHTML = `⏳ Смена ключа (${current}/${total})...`;
    });

    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = textResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Не удалось найти JSON-массив в ответе ИИ");

    const parsedArray = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsedArray) || parsedArray.length === 0) {
      throw new Error("ИИ вернул пустой список или неверный формат");
    }

    let addedCount = 0;
    parsedArray.forEach((item, index) => {
      if (item.term && item.definition) {
        const newCard = {
          id: "w-" + Date.now() + "-" + index,
          term: item.term.trim(),
          transcription: item.transcription || "",
          forms: Array.isArray(item.forms) ? item.forms : [],
          definition: item.definition.trim(),
          example: item.example || "",
          exampleTranslation: item.exampleTranslation || "",
          category: category
        };
        
        const exists = State.words.some(w => w.term.toLowerCase() === newCard.term.toLowerCase() && w.category.toLowerCase() === category.toLowerCase());
        if (!exists) {
          State.words.unshift(newCard);
          addedCount++;
        }
      }
    });

    Storage.setWords(State.words);
    State.currentCategory = "ALL";
    document.getElementById("categoryFilter").value = "ALL";
    updateCategoryUI();
    renderDictionary();
    renderFlashcard();

    rawTextInput.value = "";
    subjectInput.value = "";
    showToast(`✨ Успешно создано карточек: ${addedCount}!`);
    switchTab("cardsView");

  } catch (err) {
    if (err.message.startsWith("QUOTA_EXHAUSTED")) {
      let waitSec = parseRetrySeconds(err.message.split("|")[1]);
      showToast(`⏳ Лимит ключей! Подождите ${waitSec} сек.`);
    } else if (err.message === "NO_API_KEY") {
      showToast("❌ Укажите API Key!");
    } else {
      showToast(`❌ Ошибка генерации: ${err.message}`);
    }
  } finally {
    batchBtn.innerHTML = originalText;
    batchBtn.disabled = false;
  }
};
    // Инициализация
    updateCategoryUI();
    renderFlashcard();
    renderDictionary();
    // --- Управление аккордеонами в разделе "+ Добавить" ---
window.toggleAccordion = function(header) {
    const card = header.parentElement;
    card.classList.toggle('active');
};