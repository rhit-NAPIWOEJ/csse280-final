var osc = osc || {};
//these arrays are technically not constant, but would be updated on page init and certain page updates
//here they currently just have sample data inside them
osc.LANG_LIST = ["C", "C++", "C#", "Go", "Java", "Rust"];
osc.LICENSE_LIST = ["GPL", "MIT"];
osc.converter = null;
osc.engineDetailManager = null;
osc.engineListManager = null;
osc.authManager = null;

function htmlToElement(html) {
	var template = document.createElement('template');
	template.innerHTML = DOMPurify.sanitize(html.trim());
	return template.content.firstChild;
}

osc.EngineSearchController = class {
    constructor() {      
        let langDrop = document.getElementById("program-lang-drop");
        let licenseDrop = document.getElementById("license-drop");
        let winBox = document.getElementById("windows-cbox");
        let linuxBox = document.getElementById("linux-cbox");
        let macBox = document.getElementById("macos-cbox");

        for (let lang of osc.LANG_LIST) langDrop.appendChild(htmlToElement(`<option value="${lang}">${lang}</option>`));
        for (let license of osc.LICENSE_LIST) licenseDrop.appendChild(htmlToElement(`<option value="${license}">${license}</option>`));

        /**
         * NOTE:
         * Though navigator.userAgent is a universally supported and non-depricated way of obtaining browser/OS information,
         * the browser may not provide complete information over a non-secure HTTP transfer and/or spoof this value.
         * Fortunately, it is mostly here as a convenience of life and not a mandatory feature to have operational.
         */
        winBox.checked = /Win/.test(navigator.userAgent);
        linuxBox.checked = /Linux/.test(navigator.userAgent);
        macBox.checked = /Mac/.test(navigator.userAgent);

        document.getElementById("engine-search-btn").addEventListener('click', e => {
            let protocolList = [];
            if (document.getElementById("uci-cbox").checked) protocolList.append("UCI");
            if (document.getElementById("cecp-cbox").checked) protocolList.append("CECP");

            let osList = [];
            if (winBox.checked) osList.append("Windows");        
            if (linuxBox.checked) osList.append("Linux");
            if (macBox.checked) osList.append("MacOS");

            //well, there would be more code here if i could finish this feature
        });
        osc.engineListManager = new osc.EngineListManager();
        osc.engineListManager.beginListening(this.updateList.bind(this));
    }
    updateList() {
        let engineCardList = document.getElementById("engineCardContainer");
        while (engineCardList.firstChild) engineCardList.removeChild(engineCardList.firstChild);
        for (let i = 0; i < osc.engineListManager.length; i++) {
            let data = osc.engineListManager.getDocSnapAtIndex(0);
            const newItem = htmlToElement(
                `<div class="engine-search-tool">
                    <h3>${data.get("name")}</h3>
                    <p>A ${data.get("license")} engine in ${data.get("language")}</p>
                    <p>for ${data.get("os").toString().replace(",", ", ")}.</p>
                </div>`);
            engineCardList.appendChild(newItem);
            newItem.addEventListener('click', e => {
                document.location.href = `/engine.html?engine=${data.get("name")}`;
            });
        }    

        engineCardList = document.getElementById("yourEngineCardContainer");
        while (engineCardList.firstChild) engineCardList.removeChild(engineCardList.firstChild);
        for (let i = 0; i < osc.engineListManager.length2; i++) {
            let data = osc.engineListManager.getDocSnapAtIndex2(0);
            const newItem = htmlToElement(
                `<div class="engine-search-tool">
                    <h3>${data.get("name")}</h3>
                    <p>A ${data.get("license")} engine in ${data.get("language")}</p>
                    <p>for ${data.get("os").toString().replace(",", ", ")}.</p>
                </div>`);
            engineCardList.appendChild(newItem);
            newItem.addEventListener('click', e => {
                document.location.href = `/engine.html?engine=${data.get("name")}`;
            });
        }  
    }
}
osc.EngineListManager = class {
    constructor() {
        this._documentSnapshots = [];
        this._documentSnapshots2 = [];
		this._ref = firebase.firestore().collection("engines");
		this._unsubscribe = null;
        this._unsubscribe2 = null;
    }
    beginListening(changeListener) {
		let query = this._ref.orderBy("lastUpdated", "desc").limit(50);
        let query2 = this._ref.orderBy("lastUpdated", "desc").limit(10).where("uid", "==", (osc.authManager.uid)?osc.authManager.uid:"0");

		this._unsubscribe = query.onSnapshot(querySnapshot => {
			this._documentSnapshots = querySnapshot.docs;
			changeListener();
		});
        this._unsubscribe2 = query2.onSnapshot(querySnapshot => {
			this._documentSnapshots2 = querySnapshot.docs;
			changeListener();
		});
	}
	stopListening() { this._unsubscribe(); this._unsubscribe2(); }
    get length() { return this._documentSnapshots.length; }
    getDocSnapAtIndex(index) { return this._documentSnapshots[index]; }
    get length2() { return this._documentSnapshots2.length; }
    getDocSnapAtIndex2(index) { return this._documentSnapshots2[index]; }
}

osc.EnginePageController = class {
    constructor(engineName) {
        this.engineName = document.title = DOMPurify.sanitize(engineName);       
        osc.engineDetailManager = new osc.EngineDetailManager(this.engineName);
        osc.engineDetailManager.beginListening(this.initializeView.bind(this));
    }  
    initializeView() {
        let authorList = document.getElementById("author-list");
        let sourceList = document.getElementById("source-list");
        let ratingList = document.getElementById("rating-list");
        let osList = document.getElementById("os-list");

        osc.engineDetailManager.returnLogo().then(url => {
            document.getElementById("engine-logo").src = url;
        });

        //Idea for emptying "ul"s from https://developer.mozilla.org/en-US/docs/Web/API/Node/removeChild
        for (let list of [authorList, sourceList, ratingList, osList]) while (list.firstChild) list.removeChild(list.firstChild);
        
        authorList.innerHTML = "Authors:";
        osList.innerHTML = "Supported OS:";
        sourceList.innerHTML = "Source Code:";
        ratingList.innerHTML = "Ratings:";    
        document.getElementById("language-label").innerHTML = DOMPurify.sanitize(`Programming Language: ${osc.engineDetailManager.language}`);
        document.getElementById("license-label").innerHTML = DOMPurify.sanitize(`Licensed Under: ${osc.engineDetailManager.license}`);
 
        document.getElementById("md-article").innerHTML = DOMPurify.sanitize(
            `<p style="text-align:right"><a href="/edit.html?engine=${this.engineName}">Edit</a></p>` + osc.converter.makeHtml(osc.engineDetailManager.readme));

        for (let author of osc.engineDetailManager.authors) authorList.append(htmlToElement(`<li>${author}</li>`));
        for (let source of osc.engineDetailManager.sources) sourceList.append(htmlToElement(`<li><a target="_blank" href="${source.url}">${source.site}</a></li>`));
        for (let rating of osc.engineDetailManager.ratings) ratingList.append(htmlToElement(`<li><a target="_blank" href="${rating.url}">${rating.site}</a></li>`));
        for (let os of osc.engineDetailManager.os) osList.append(htmlToElement(`<li>${os}</li>`));  
    }
}
osc.EditPageController = class {
    constructor(engineName) {
        document.title = DOMPurify.sanitize(engineName);
        
        osc.engineDetailManager = new osc.EngineDetailManager(engineName);
        osc.engineDetailManager.beginListening(this.initializeView.bind(this));

        this.engine = new osc.Engine();

        let authorInput = document.getElementById("author-input");
        let authorList = document.getElementById("author-list");
        document.getElementById("author-add").addEventListener('click', e => {
            if (authorInput.value.trim() != "") {
                this.engine.authors.push(authorInput.value.trim());
                authorList.append(htmlToElement(`<li>${authorInput.value.trim()}</li>`));
                authorList.lastChild.addEventListener('click', function (e) {
                    //no, this can NOT be an arrow function; i need the value of 'this' to be the last child
                    authorInput.value = this.innerHTML;
                });
                authorInput.value = "";
            }
        });
        document.getElementById("author-remove").addEventListener('click', e => {
            let index = this.engine.authors.indexOf(authorInput.value.trim());
            if (index != -1) {
                this.engine.authors.splice(index, 1);
                for (let child of authorList.children) if (child.innerHTML == authorInput.value.trim()) authorList.removeChild(child);
            }
            authorInput.value = "";
        });

        let sourceInput = document.getElementById("source-input");
        let sourceURLInput = document.getElementById("source-url-input");
        let sourceList = document.getElementById("source-list");
        document.getElementById("source-add").addEventListener('click', e => {
            if (sourceInput.value.trim() != "" && sourceURLInput.value.trim() != "") {
                this.engine.sources.push({"site": sourceInput.value.trim(), "url": sourceURLInput.value.trim()});
                sourceList.append(htmlToElement(`<li>${sourceInput.value} <a href="${sourceURLInput.value}">(link)</a></li>`));
                sourceList.lastChild.addEventListener('click', function (e) {
                    sourceInput.value = this.innerText.substring(0, this.innerText.length - 7);
                    sourceURLInput.value = this.lastChild.href;
                });
                sourceInput.value = "";
                sourceURLInput.value = "";
            }
        });
        document.getElementById("source-remove").addEventListener('click', e => {
            let index = -1;
            for (let i = 0; i < this.engine.sources.length; i++)
                if (this.engine.sources[i].site == sourceInput.value.trim() && this.engine.sources[i].url == sourceURLInput.value.trim()) {
                    index = i;  break;
                }
            if (index != -1) {
                this.engine.sources.splice(index, 1);
                for (let child of sourceList.children) if (child.innerText.indexOf(sourceInput.value.trim()) != -1) sourceList.removeChild(child);
            }
            sourceInput.value = "";
            sourceURLInput.value = "";
        });

        let ratingInput = document.getElementById("rating-input");
        let ratingURLInput = document.getElementById("rating-url-input");
        let ratingList = document.getElementById("rating-list");
        document.getElementById("rating-add").addEventListener('click', e => {
            if (ratingInput.value.trim() != "" && ratingURLInput.value.trim() != "") {
                this.engine.ratings.push({"site": ratingInput.value.trim(), "url": ratingURLInput.value.trim()});
                ratingList.append(htmlToElement(`<li>${ratingInput.value} <a href="${ratingURLInput.value}">(link)</a></li>`));
                ratingList.lastChild.addEventListener('click', function (e) {
                    ratingInput.value = this.innerText.substring(0, this.innerText.length - 7);
                    ratingURLInput.value = this.lastChild.href;
                });
                ratingInput.value = "";
                ratingURLInput.value = "";
            }
        });
        document.getElementById("rating-remove").addEventListener('click', e => {
            let index = -1;
            for (let i = 0; i < this.engine.ratings.length; i++)
                if (this.engine.ratings[i].site == ratingInput.value.trim() && this.engine.ratings[i].url == ratingURLInput.value.trim()) {
                    index = i;  break;
                }
            if (index != -1) {
                this.engine.ratings.splice(index, 1);
                for (let child of ratingList.children) if (child.innerText.indexOf(ratingInput.value.trim()) != -1) ratingList.removeChild(child);
            }
            ratingInput.value = "";
            ratingURLInput.value = "";
        });

        let logoInput = document.getElementById("logo-upload");
        logoInput.addEventListener('change', e => {
            document.getElementById("engine-logo").src = URL.createObjectURL(logoInput.files[0]);
        });

        document.getElementById("submit-button").addEventListener('click', e => {
            osc.engineDetailManager.update(this.engine)
            .then(() => document.location.href = `/engine.html?engine=${engineName}`);
        });
    }
    initializeView() {
        if (!this.engine.os.length) this.engine.os = osc.engineDetailManager.os;
        if (!this.engine.readme) this.engine.readme = osc.engineDetailManager.readme;
        if (!this.engine.authors.length) this.engine.authors = osc.engineDetailManager.authors;
        if (!this.engine.license) this.engine.license = osc.engineDetailManager.license;
        if (!this.engine.sources.length) this.engine.sources = osc.engineDetailManager.sources;
        if (!this.engine.ratings.length) this.engine.ratings = osc.engineDetailManager.ratings;
        if (!this.engine.language) this.engine.language = osc.engineDetailManager.language;

        osc.engineDetailManager.returnLogo().then(url => {
            document.getElementById("engine-logo").src = url;
            document.getElementById("engine-logo").alt = "Logo of " + document.title; /* :/  */
        });
        
        if (this.engine.os) {
            document.getElementById("windows-cbox").checked = (this.engine.os.indexOf("Windows") != -1);
            document.getElementById("linux-cbox").checked = (this.engine.os.indexOf("Linux") != -1);
            document.getElementById("macos-cbox").checked = (this.engine.os.indexOf("MacOS") != -1);
        }

        if (this.engine.language) document.getElementById("lang-input").value = this.engine.language;
        if (this.engine.license) document.getElementById("license-input").value = this.engine.license;
        if (this.engine.readme) document.getElementById("md-article-edit").value = this.engine.readme;

        if (this.engine.authors) {
            let authorList = document.getElementById("author-list");
            for (let author of this.engine.authors) {
                authorList.append(htmlToElement(`<li>${author}</li>`));
                authorList.lastChild.addEventListener('click', function (e) {
                    document.getElementById("author-input").value = this.innerHTML;
                });
            }
        }
        if (this.engine.sources) {  
            let sourceList = document.getElementById("source-list");
            for (let source of this.engine.sources) {
                sourceList.append(htmlToElement(`<li>${source.site} <a href="${source.url}">(link)</a></li>`));
                sourceList.lastChild.addEventListener('click', function (e) {
                    document.getElementById("source-input").value = this.innerText.substring(0, this.innerText.length - 7);
                    document.getElementById("source-url-input").value = this.lastChild.href;
                });
            }
        }
        if (this.engine.ratings) {  
            let ratingList = document.getElementById("rating-list");      
            for (let rating of this.engine.ratings) {
                ratingList.append(htmlToElement(`<li>${rating.site} <a href="${rating.url}">(link)</a></li>`));
                ratingList.lastChild.addEventListener('click', function (e) {
                    document.getElementById("rating-input").value = this.innerText.substring(0, this.innerText.length - 7);
                    document.getElementById("rating-url-input").value = this.lastChild.href;
                })
            }
        }
    }
}
osc.EngineDetailManager = class {
    constructor(engineName) {
        osc.converter = new showdown.Converter();
        this._unsubscribe = null;
        this._documentSnapshot = {};
        this._ref = firebase.firestore().collection("engines").doc(engineName);
        this.engineName = engineName;
    }
    beginListening(changeListener) {
		this._unsubscribe = this._ref.onSnapshot(doc => {
			this._documentSnapshot = doc;
			changeListener();
		});
	}
	stopListening() { this._unsubscribe(); }
    update(engineData) {
        return this._ref.update({
            ["os"]: engineData.os || [],
            ["uid"]: osc.authManager.uid || "", //also a last-minute addition
            ["name"]: this.engineName, //this is completely embarassing how I have to do this for engine boxes on homepage
			["readme"]: engineData.readme || "",
            ["authors"]: engineData.authors || [],
            ["license"]: engineData.license || "",          
            ["sources"]: engineData.sources || [],
            ["ratings"]: engineData.ratings || [],
            ["language"]: engineData.language || "",
            ["lastUpdated"]: firebase.firestore.Timestamp.now(),
		}).then(resp => this.updateImage(engineData));
    }
    updateImage() {
        let logoInput = document.getElementById("logo-upload").files[0];
        if (logoInput)
            return firebase.storage().ref().child(`logos/${this.engineName}`).put(logoInput, { "content-type": logoInput.type });
    }
    returnLogo() { return firebase.storage().ref().child(`logos/${this.engineName}`).getDownloadURL(); }
    get os() { return this._documentSnapshot.get("os"); }
    get readme() { return this._documentSnapshot.get("readme"); }
    get authors() { return this._documentSnapshot.get("authors"); }
    get license() { return this._documentSnapshot.get("license"); }
    get sources() { return this._documentSnapshot.get("sources"); }
    get ratings() { return this._documentSnapshot.get("ratings"); }
    get language() { return this._documentSnapshot.get("language"); }
}

osc.Engine = class {
    constructor() {
        this.os = [];
        this.logo = "";
        this.readme = "";
        this.authors = [];
        this.sources = [];
        this.ratings = [];
        this.license = "";
        this.language = "";
    }
}

osc.AuthenticationManager = class {
    constructor() {
        this.uid = null;
        this.flag = 0;
        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                var displayName = user.displayName;
                var email = user.email;
                this.uid = user.uid;
                console.log(`The user is signed in ${this.uid}`);
                console.log('email :>> ', email);

                document.getElementById("login-popup-link").innerHTML = "Logout";
            } else {
                console.log(`There is no user signed in!`);
                this.uid = null;
                document.getElementById("login-popup-link").innerHTML = "Login";
            }
            if (!this.flag) {
                if (document.getElementById("engine-search")) {
                    new osc.EngineListManager();
                    new osc.EngineSearchController();
                }
                if (document.getElementById("md-article")) {
                    const urlParams = new URLSearchParams(window.location.search);
                    new osc.EnginePageController(urlParams.get('engine'));
                }
                if (document.getElementById("md-article-edit")) {
                    const urlParams = new URLSearchParams(window.location.search);
                    new osc.EditPageController(urlParams.get('engine'));
                }
                this.flag = 1;
            }
        });

        document.getElementById("login-button").addEventListener('click', e => {
            firebase.auth().signInWithEmailAndPassword(document.getElementById("login-email").value, document.getElementById("login-password").value)
		    .catch(error => { console.error(`Existing account login error ${error.code} ${error.message}`); });
            document.getElementById("login-popup").style.display = "none";
            document.getElementById("popup-background").hidden = true; 
        });
        document.getElementById("new-account-button").addEventListener('click', e => {
            let inputPassword1 = document.getElementById("new-account-password1");
            let inputPassword2 = document.getElementById("new-account-password2");
            if (inputPassword1.value == inputPassword2.value)
                firebase.auth().createUserWithEmailAndPassword(document.getElementById("new-account-email").value, inputPassword1.value)
                .catch(error => { console.error(`Create account error ${error.code} ${error.message}`); });
            else {
                alert("Passwords did not match.");
                inputPassword1.value = "";
                inputPassword2.value = "";
            }
            document.getElementById("login-popup").style.display = "none";
            document.getElementById("popup-background").hidden = true;
        });
    }
}

osc.NavbarManager = class {
    constructor() {
        //osc.AuthenticationManager handles the interactions with these menus
        document.getElementById("login-popup-link").addEventListener('click', e => {
            if (document.getElementById("login-popup-link").innerHTML == "Login") {
                document.getElementById("login-popup").style.display = "inline-block";
                document.getElementById("popup-background").hidden = false;
            } else
                firebase.auth().signOut();
        });
        document.getElementById("login-popup-close").addEventListener('click', e => {
            document.getElementById("login-popup").style.display = "none";
            document.getElementById("popup-background").hidden = true;       
        });

        document.getElementById("new-engine-popup-link").addEventListener('click', e => {
            document.getElementById("new-engine-popup").style.display = "inline-block";
            document.getElementById("popup-background").hidden = false;
        });
        document.getElementById("new-engine-popup-close").addEventListener('click', e => {
            document.getElementById("new-engine-popup").style.display = "none";
            document.getElementById("popup-background").hidden = true;       
        });
        document.getElementById("new-engine-button").addEventListener('click', e => {
            //WTF? Why does the URL this go to contain spaces?? %20, do you exist??
            document.location.href = `/edit.html?engine=${encodeURIComponent(document.getElementById("engine-name-input").value.trim())}`;
        });
    }
}

osc.main = function () {
    new osc.NavbarManager();
    osc.authManager = new osc.AuthenticationManager();
};

osc.main();