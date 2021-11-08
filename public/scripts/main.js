var osc = osc || {};
//these arrays are technically not constant, but are updated on page init and certain page updates
//here they currently just have sample data inside them
osc.LANG_LIST = ["C", "C++", "C#", "Go", "Java", "Rust"];
osc.LICENSE_LIST = ["GPL", "MIT"];
osc.converter = null;
osc.engineDetailManager = null;


function htmlToElement(html) {
	var template = document.createElement('template');
	template.innerHTML = html.trim();
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

            osc.findEngines(programLangDrop.value, licenseDrop.value,
                protocolList, (document.getElementById("protocol-drop").value == "All of"),
                osList, (document.getElementById("os-drop").value == "All of"));
        });
    }
}

osc.EnginePageController = class {
    constructor(engineName) {
        this.engineName = document.title = engineName;       
        osc.engineDetailManager = new osc.EngineDetailManager(engineName);
        osc.engineDetailManager.beginListening(this.initializeView.bind(this));
    }  
    initializeView() {
        let authorList = document.getElementById("author-list");
        let sourceList = document.getElementById("source-list");
        let ratingList = document.getElementById("rating-list");
        let osList = document.getElementById("os-list");

        //Idea for emptying "ul"s from https://developer.mozilla.org/en-US/docs/Web/API/Node/removeChild
        for (let list of [authorList, sourceList, ratingList, osList]) while (list.firstChild) list.removeChild(list.firstChild);
        
        authorList.innerHTML = "Authors:";
        osList.innerHTML = "Supported OS:";
        sourceList.innerHTML = "Source Code:";
        ratingList.innerHTML = "Ratings:";    
        document.getElementById("language-label").innerHTML = `Programming Language: ${osc.engineDetailManager.language}`;
        document.getElementById("license-label").innerHTML = `Licensed Under: ${osc.engineDetailManager.license}`;

        /**
         * WARNING:
         * Showdown does allow HTML tags to be used as part of its Markdown-formatted text. As a result,
         * Cross Site Scripting (XSS) attacks are possible with this library if not handled properly.
         * Then again, probably everything we made with input is susceptible to XSS, so ¯\_(ツ)_/¯.
         * In testing, modern browsers may disable scripts in the README, but old versions of IE may not.
         * */ 
        document.getElementById("md-article").innerHTML =
            `<p style="text-align:right"><a href="/edit.html?engine=${this.engineName}">Edit</a></p>` + osc.converter.makeHtml(osc.engineDetailManager.readme);

        for (let author of osc.engineDetailManager.authors) authorList.append(htmlToElement(`<li>${author}</li>`));
        for (let source of osc.engineDetailManager.sources) sourceList.append(htmlToElement(`<li><a target="_blank" href="${source.url}">${source.site}</a></li>`));
        for (let rating of osc.engineDetailManager.ratings) ratingList.append(htmlToElement(`<li><a target="_blank" href="${rating.url}">${rating.site}</a></li>`));
        for (let os of osc.engineDetailManager.os) osList.append(htmlToElement(`<li>${os}</li>`));  
    }
}
osc.EditPageController = class {
    constructor(engineName) {
        document.title = engineName;
        
        osc.engineDetailManager = new osc.EngineDetailManager(engineName);
        osc.engineDetailManager.beginListening(this.initializeView.bind(this));

        this.engine = new osc.Engine();

        document.getElementById("submit-button").addEventListener('click', e => {
            osc.engineDetailManager.update(this.engine)
            .then(() => document.location.href = `/engine.html?engine=${engineName}`);
        });

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

    }
    initializeView() {
        this.engine.os = osc.engineDetailManager.os;
        this.engine.readme = osc.engineDetailManager.readme;
        this.engine.authors = osc.engineDetailManager.authors;
        this.engine.license = osc.engineDetailManager.license;
        this.engine.sources = osc.engineDetailManager.sources;
        this.engine.ratings = osc.engineDetailManager.ratings;
        this.engine.language = osc.engineDetailManager.language;
        
        document.getElementById("windows-cbox").checked = (this.engine.os.indexOf("Windows") != -1);
        document.getElementById("linux-cbox").checked = (this.engine.os.indexOf("Linux") != -1);
        document.getElementById("macos-cbox").checked = (this.engine.os.indexOf("MacOS") != -1);

        document.getElementById("lang-input").value = this.engine.language;
        document.getElementById("license-input").value = this.engine.license;
        document.getElementById("md-article-edit").value = this.engine.readme;

        let authorList = document.getElementById("author-list");
        for (let author of this.engine.authors) {
            authorList.append(htmlToElement(`<li>${author}</li>`));
            authorList.lastChild.addEventListener('click', function (e) {
                document.getElementById("author-input").value = this.innerHTML;
            });
        }

        let sourceList = document.getElementById("source-list");
        for (let source of this.engine.sources) {
            sourceList.append(htmlToElement(`<li>${source.site} <a href="${source.url}">(link)</a></li>`));
            sourceList.lastChild.addEventListener('click', function (e) {
                document.getElementById("source-input").value = this.innerText.substring(0, this.innerText.length - 7);
                document.getElementById("source-url-input").value = this.lastChild.href;
            });
        }

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
osc.EngineDetailManager = class {
    constructor(engineName) {
        osc.converter = new showdown.Converter();
        this._unsubscribe = null;
        this._documentSnapshot = {};
        this._ref = firebase.firestore().collection("engines").doc(engineName);
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
            ["os"]: engineData.os,
			["readme"]: engineData.readme,
            ["authors"]: engineData.authors,
            ["license"]: engineData.license,          
            ["sources"]: engineData.sources,
            ["ratings"]: engineData.ratings,
            ["language"]: engineData.language,
            ["lastUpdated"]: firebase.firestore.Timestamp.now(),
		});
    }
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
        this.readme = "";
        this.authors = [];
        this.sources = [];
        this.ratings = [];
        this.license = "";
        this.language = "";
    }
}

osc.findEngines = (programLang, license, protocolList, protocolAll, osList, osAll) => {

}

osc.authenticationManager = class {
    constructor() {
        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                var displayName = user.displayName;
                var email = user.email;
                var uid = user.uid;
                console.log(`The user is signed in ${uid}`);
                console.log('displayName :>> ', displayName);
                console.log('email :>> ', email);
            } else {
                console.log(`There is no user signed in!`);
            }
        });
    }
}

osc.main = function () {
    if (document.getElementById("engine-search"))
	    new osc.EngineSearchController();
    if (document.getElementById("md-article")) {
        const urlParams = new URLSearchParams(window.location.search);
        new osc.EnginePageController(urlParams.get('engine'));
    }
    if (document.getElementById("md-article-edit")) {
        const urlParams = new URLSearchParams(window.location.search);
        new osc.EditPageController(urlParams.get('engine'));
    }
};

osc.main();