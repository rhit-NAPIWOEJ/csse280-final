var osc = osc || {};
//these arrays are technically not constant, but are updated on page init and certain page updates
//here they currently just have sample data inside them
osc.LANG_LIST = ["C", "C++", "C#", "Go", "Java", "Rust"];
osc.LICENSE_LIST = ["GPL", "MIT"];
osc.converter = new showdown.Converter();
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
        
        //NOTE:
        //Though navigator.userAgent is a universally supported and non-depricated way of obtaining browser/OS information,
        //the browser may not provide complete information over a non-secure HTTP transfer and/or spoof this value.
        //Fortunately, it is mostly here as a convenience of life and not a mandatory feature to have operational.
        winBox.checked = /Win/.test(navigator.userAgent);
        linuxBox.checked = /Linux/.test(navigator.userAgent);
        macBox.checked = /Mac/.test(navigator.userAgent);

        document.getElementById("engine-search-btn").addEventListener('click', (event) => {
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
        document.title = engineName;       
        osc.engineDetailManager = new osc.EngineDetailManager(engineName);
        osc.engineDetailManager.beginListening(this.updateView.bind(this));
    }  
    updateView() {    
        let authorList = document.getElementById("author-list");
        let sourceList = document.getElementById("source-list");
        let ratingList = document.getElementById("rating-list");

        for (let list of [authorList, sourceList, ratingList]) while (list.firstChild) list.removeChild(list.firstChild);
        
        authorList.innerHTML = "Authors:";
        sourceList.innerHTML = "Source Code:";
        ratingList.innerHTML = "Ratings:";

        for (let author of osc.engineDetailManager.authors) authorList.append(htmlToElement(`<li>${author}</li>`));
        //TODO: Write other loops once data set up in firebase

        document.getElementById("md-article").innerHTML = osc.converter.makeHtml(osc.engineDetailManager.readme);
       
    }
}
osc.EditPageController = class {
    constructor(engineName) {

        document.title = engineName;
        osc.engineDetailManager = new osc.EngineDetailManager(engineName);
        osc.engineDetailManager.beginListening(this.updateView.bind(this));

        document.getElementById("submit-button").addEventListener('click', event => {
            osc.engineDetailManager.update(document.getElementById("md-article-edit").value);
        });
    }
    updateView() {
        let authorList = document.getElementById("author-list");
        
        document.getElementById("md-article-edit").value = osc.engineDetailManager.readme;

        //TODO: Add Editable Author Form
        while (authorList.firstChild) authorList.removeChild(authorList.firstChild);
        authorList.innerHTML = "Authors:";
        for (let author of osc.engineDetailManager.authors) authorList.append(htmlToElement(`<li>${author}</li>`));
        
    }
}
osc.EngineDetailManager = class {
    constructor(engineName) {
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
    update(readme) {
        this._ref.update({
			["readme"]: readme,
			["lastUpdated"]: firebase.firestore.Timestamp.now(),
		});
    }
    get readme() {
		return this._documentSnapshot.get("readme");
	}
    get authors() {
        return this._documentSnapshot.get("authors");
    }
}

osc.Engine = class {
    constructor() {

    }
}

osc.findEngines = (programLang, license, protocolList, protocolAll, osList, osAll) => {

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
