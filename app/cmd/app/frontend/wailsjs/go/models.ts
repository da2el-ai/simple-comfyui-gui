export namespace main {
	
	export class ConnectResult {
	    success: boolean;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new ConnectResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.message = source["message"];
	    }
	}
	export class QRCodeResult {
	    success: boolean;
	    message: string;
	    accessUrl: string;
	    qrCodeDataUrl: string;
	
	    static createFrom(source: any = {}) {
	        return new QRCodeResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.message = source["message"];
	        this.accessUrl = source["accessUrl"];
	        this.qrCodeDataUrl = source["qrCodeDataUrl"];
	    }
	}
	export class QRCodeListResult {
	    success: boolean;
	    message: string;
	    items: QRCodeResult[];
	
	    static createFrom(source: any = {}) {
	        return new QRCodeListResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.message = source["message"];
	        this.items = this.convertValues(source["items"], QRCodeResult);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class TagsFileExistsResult {
	    success: boolean;
	    exists: boolean;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new TagsFileExistsResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.exists = source["exists"];
	        this.message = source["message"];
	    }
	}

}

