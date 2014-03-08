/****************************************************************************
 Copyright (c) 2010-2012 cocos2d-x.org
 Copyright (c) 2008-2010 Ricardo Quesada
 Copyright (c) 2011      Zynga Inc.

 http://www.cocos2d-x.org

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

/**
 * The shared EGLView
 * @Object
 * @type {cc.EGLView}
 */
cc.view;

cc.Touches = [];
cc.TouchesIntergerDict = {};

/**
 * @class
 * @extends cc.Class
 */
cc.EGLView = cc.Class.extend(/** @lends cc.EGLView# */{
    _delegate: null,
    // Size of parent node that contains cc.container and cc._canvas
    _frameSize: null,
    // resolution size, it is the size appropriate for the app resources.
    _designResolutionSize: null,
    _originalDesignResolutionSize: null,
    // Viewport is the container's rect related to content's coordinates in pixel
    _viewPortRect: null,
    // The visible rect in content's coordinate in point
    _visibleRect: null,
    // The device's pixel ratio (for retina displays)
    _devicePixelRatio: 1,
    // the view name
    _viewName: "",
    // Custom callback for resize event
    _resizeCallback: null,
    _scaleX: 1,
    _originalScaleX: 1,
    _scaleY: 1,
    _originalScaleY: 1,
    _indexBitsUsed: 0,
    _maxTouches: 5,
    _resolutionPolicy: null,
    _rpExactFit: null,
    _rpShowAll: null,
    _rpNoBorder: null,
    _rpFixedHeight: null,
    _rpFixedWidth: null,
    _initialized: false,

    _captured: false,
    _wnd: null,
    _hDC: null,
    _hRC: null,
    _supportTouch: false,
    _contentTranslateLeftTop: null,

    // Parent node that contains cc.container and cc._canvas
    _frame: null,
    _frameZoomFactor: 1.0,
    __resizeWithBrowserSize: false,
    _isAdjustViewPort: true,

    ctor: function () {
        this._frame = (cc.container.parentNode === document.body) ? document.documentElement : cc.container.parentNode;
        this._frameSize = cc.size(0, 0);
        this._initFrameSize();

        var w = cc._canvas.width, h = cc._canvas.height;
        this._designResolutionSize = cc.size(w, h);
        this._originalDesignResolutionSize = cc.size(w, h);
        this._viewPortRect = cc.rect(0, 0, w, h);
        this._visibleRect = cc.rect(0, 0, w, h);
        this._contentTranslateLeftTop = {left: 0, top: 0};
        this._viewName = "Cocos2dHTML5";

        cc.visibleRect.init(this._designResolutionSize);

        // Setup system default resolution policies
        this._rpExactFit = new cc.ResolutionPolicy(cc.ContainerStrategy.EQUAL_TO_FRAME, cc.ContentStrategy.EXACT_FIT);
        this._rpShowAll = new cc.ResolutionPolicy(cc.ContainerStrategy.PROPORTION_TO_FRAME, cc.ContentStrategy.SHOW_ALL);
        this._rpNoBorder = new cc.ResolutionPolicy(cc.ContainerStrategy.EQUAL_TO_FRAME, cc.ContentStrategy.NO_BORDER);
        this._rpFixedHeight = new cc.ResolutionPolicy(cc.ContainerStrategy.EQUAL_TO_FRAME, cc.ContentStrategy.FIXED_HEIGHT);
        this._rpFixedWidth = new cc.ResolutionPolicy(cc.ContainerStrategy.EQUAL_TO_FRAME, cc.ContentStrategy.FIXED_WIDTH);

        this._hDC = cc._canvas;
        this._hRC = cc._renderContext;
    },

    // Resize helper functions
    _resizeEvent: function () {
        var width = this._originalDesignResolutionSize.width;
        var height = this._originalDesignResolutionSize.height;
        if (this._resizeCallback) {
            this._initFrameSize();
            this._resizeCallback.call();
        }
        if (width > 0)
            this.setDesignResolutionSize(width, height, this._resolutionPolicy);
    },

    resizeWithBrowserSize: function (enabled) {
        var adjustSize;
        if (enabled) {
            //enable
            if (!this.__resizeWithBrowserSize) {
                this.__resizeWithBrowserSize = true;
                adjustSize = this._resizeEvent.bind(this);
                window.addEventListener('resize', adjustSize, false);
            }
        } else {
            //disable
            if (this.__resizeWithBrowserSize) {
                this.__resizeWithBrowserSize = true;
                adjustSize = this._resizeEvent.bind(this);
                window.removeEventListener('resize', adjustSize, false);
            }
        }
    },

    setResizeCallback: function (callback) {
        if (typeof callback == "function" || callback == null) {
            this._resizeCallback = callback;
        }
    },

    _initFrameSize: function () {
        var locFrameSize = this._frameSize;
        locFrameSize.width = this._frame.clientWidth;
        locFrameSize.height = this._frame.clientHeight;
    },

    // hack
    _adjustSizeKeepCanvasSize: function (width, height) {
        var designWidth = this._originalDesignResolutionSize.width;
        var designHeight = this._originalDesignResolutionSize.height;
        if (designWidth > 0)
            this.setDesignResolutionSize(designWidth, designHeight, this._resolutionPolicy);
    },

    _setViewPortMeta: function (width, height) {
        if (this._isAdjustViewPort) {
	        var viewportMetas = {"user-scalable": "no", "maximum-scale": "1.0", "initial-scale": "1.0"}, elems = document.getElementsByName("viewport"), vp, content;
            if (elems.length == 0) {
                vp = document.createElement("meta");
                vp.name = "viewport";
                vp.content = "";
                document.head.appendChild(vp);
            }
            else vp = elems[0];

	        // For avoiding Android Firefox issue, to remove once firefox fixes its issue.
	        if (cc.sys.isMobile && cc.sys.browserType == cc.sys.BROWSER_TYPE_FIREFOX) {
		        vp.content = "initial-scale:1";
		        return;
	        }

            content = vp.content;
            for (var key in viewportMetas) {
                var pattern = new RegExp(key);
                if (!pattern.test(content)) {
                    content += (content == "" ? "" : ",") + key + "=" + viewportMetas[key];
                }
            }
            /*
            if(width<=320){
                width = 321;
            }
            if(height)
                content ="height="+height+","+content;
            if(width)
                content ="width="+width+","+content;
            */
            vp.content = content;
        }
    },

    // RenderTexture hacker
    _setScaleXYForRenderTexture: function () {
        //hack for RenderTexture on canvas mode when adapting multiple resolution resources
        var scaleFactor = cc.CONTENT_SCALE_FACTOR();
        this._scaleX = scaleFactor;
        this._scaleY = scaleFactor;
    },

    // Other helper functions
    _resetScale: function () {
        this._scaleX = this._originalScaleX;
        this._scaleY = this._originalScaleY;
    },

    // Useless, just make sure the compatibility temporarily, should be removed
    _adjustSizeToBrowser: function () {
    },

    /**
     * init
     */
    initialize: function () {
        this._initialized = true;
    },

    adjustViewPort: function (enabled) {
        this._isAdjustViewPort = enabled;
    },

    /**
     * Force destroying EGL view, subclass must implement this method.
     */
    end: function () {
    },

    /**
     * Get whether render system is ready(no matter opengl or canvas),
     * this name is for the compatibility with cocos2d-x, subclass must implement this method.
     * @return {Boolean}
     */
    isOpenGLReady: function () {
        return (this._hDC != null && this._hRC != null);
    },

    /*
     * Set zoom factor for frame. This method is for debugging big resolution (e.g.new ipad) app on desktop.
     * @param {Number} zoomFactor
     */
    setFrameZoomFactor: function (zoomFactor) {
        this._frameZoomFactor = zoomFactor;
        this.centerWindow();
        cc.director.setProjection(cc.director.getProjection());
    },

    /**
     * Exchanges the front and back buffers, subclass must implement this method.
     */
    swapBuffers: function () {
    },

    /**
     * Open or close IME keyboard , subclass must implement this method.
     */
    setIMEKeyboardState: function (isOpen) {
        if (isOpen) {
            // [EAGLView sharedEGLView] becomeFirstResponder
        } else {
            //  [EAGLView sharedEGLView] resignFirstResponder
        }
    },

    /**
     * <p>
     *   The resolution translate on EGLView
     * </p>
     * @param {Number} offsetLeft
     * @param {Number} offsetTop
     */
    setContentTranslateLeftTop: function (offsetLeft, offsetTop) {
        this._contentTranslateLeftTop = {left: offsetLeft, top: offsetTop};
    },

    /**
     * <p>
     *   get the resolution translate on EGLView
     * </p>
     * @return {cc.Size|Object}
     */
    getContentTranslateLeftTop: function () {
        return this._contentTranslateLeftTop;
    },

    /**
     * Get the frame size of EGL view.
     * In general, it returns the screen size since the EGL view is a fullscreen view.
     * @return {cc.Size}
     */
    getFrameSize: function () {
        return cc.size(this._frameSize.width, this._frameSize.height);
    },

    /**
     * Set the frame size of EGL view.
     * @param {Number} width
     * @param {Number} height
     */
    setFrameSize: function (width, height) {
        this._frameSize.width = width;
        this._frameSize.height = height;
        this._frame.style.width = width + "px";
        this._frame.style.height = height + "px";
        //this.centerWindow();
        this._resizeEvent();
        cc.director.setProjection(cc.director.getProjection());
    },

    centerWindow: function () {
    },

    /**
     * Get the visible area size of OpenGL view port.
     * @return {cc.Size}
     */
    getVisibleSize: function () {
        return cc.size(this._visibleRect.width,this._visibleRect.height);
    },

    /**
     * Get the visible origin of OpenGL view port.
     * @return {cc.Point}
     */
    getVisibleOrigin: function () {
        return cc.p(this._visibleRect.x,this._visibleRect.y);
    },

    canSetContentScaleFactor: function () {
        return true;
    },

    /**
     * Get the current resolution policy
     * @return {cc.ResolutionPolicy}
     */
    getResolutionPolicy: function () {
        return this._resolutionPolicy;
    },

    /**
     * Set the current resolution policy
     * @param {cc.ResolutionPolicy|Number} resolutionPolicy
     */
    setResolutionPolicy: function (resolutionPolicy) {
        if (resolutionPolicy instanceof cc.ResolutionPolicy) {
            this._resolutionPolicy = resolutionPolicy;
        }
        // Ensure compatibility with JSB
        else {
            switch (resolutionPolicy) {
                case cc.ResolutionPolicy.EXACT_FIT:
                    this._resolutionPolicy = this._rpExactFit;
                    break;
                case cc.ResolutionPolicy.SHOW_ALL:
                    this._resolutionPolicy = this._rpShowAll;
                    break;
                case cc.ResolutionPolicy.NO_BORDER:
                    this._resolutionPolicy = this._rpNoBorder;
                    break;
                case cc.ResolutionPolicy.FIXED_HEIGHT:
                    this._resolutionPolicy = this._rpFixedHeight;
                    break;
                case cc.ResolutionPolicy.FIXED_WIDTH:
                    this._resolutionPolicy = this._rpFixedWidth;
                    break;
            }
        }
    },

    /**
     * Set the design resolution size.
     * @param {Number} width Design resolution width.
     * @param {Number} height Design resolution height.
     * @param {cc.ResolutionPolicy|Number} resolutionPolicy The resolution policy desired, you may choose:
     * [1] ResolutionExactFit       Fill screen by stretch-to-fit: if the design resolution ratio of width to height is different from the screen resolution ratio, your game view will be stretched.
     * [2] ResolutionNoBorder       Full screen without black border: if the design resolution ratio of width to height is different from the screen resolution ratio, two areas of your game view will be cut.
     * [3] ResolutionShowAll        Full screen with black border: if the design resolution ratio of width to height is different from the screen resolution ratio, two black borders will be shown.
     * [4] ResolutionFixedHeight    Scale the content's height to screen's height and proportionally scale its width
     * [5] ResolutionFixedWidth     Scale the content's width to screen's width and proportionally scale its height
     * [cc.ResolutionPolicy]        Custom resolution policy, constructed by cc.ResolutionPolicy
     */
    setDesignResolutionSize: function (width, height, resolutionPolicy) {
        // Defensive code
        if (isNaN(width) || width == 0 || isNaN(height) || height == 0) {
            cc.log("Resolution not valid");
            return;
        }
        this.setResolutionPolicy(resolutionPolicy);
        var policy = this._resolutionPolicy;
        if (policy)
            policy.preApply(this);
        else {
            cc.log("should set resolutionPolicy");
            return;
        }

        // Reinit frame size
        var frameW = this._frameSize.width, frameH = this._frameSize.height;
        if (cc.sys.isMobile)
            this._setViewPortMeta(this._frameSize.width, this._frameSize.height);
        this._initFrameSize();
        // No change
        if (resolutionPolicy == this._resolutionPolicy
            && width == this._originalDesignResolutionSize.width && height == this._originalDesignResolutionSize.height
            && frameW == this._frameSize.width && frameH == this._frameSize.height)
            return;
        this._designResolutionSize = cc.size(width, height);
        this._originalDesignResolutionSize = cc.size(width, height);

        var result = policy.apply(this, this._designResolutionSize);
        if (result.scale && result.scale.length == 2) {
            this._scaleX = result.scale[0];
            this._scaleY = result.scale[1];
        }
        if (result.viewport) {
            var vp = this._viewPortRect = result.viewport, visible = this._visibleRect;
            visible.width = cc._canvas.width / this._scaleX;
            visible.height = cc._canvas.height / this._scaleY;
            visible.x = -vp.x / this._scaleX;
            visible.y = -vp.y / this._scaleY;
        }

        // reset director's member variables to fit visible rect
        var director = cc.director;
        director._winSizeInPoints = this.getDesignResolutionSize();

        policy.postApply(this);

        if (cc._renderType == cc._RENDER_TYPE_WEBGL) {
            // reset director's member variables to fit visible rect
            director._createStatsLabel();
            director.setGLDefaultValues();
        }

        this._originalScaleX = this._scaleX;
        this._originalScaleY = this._scaleY;
        // For editbox
        if (cc.DOM) {
            cc.DOM._resetEGLViewDiv();
        }

        cc.visibleRect.init(this.getVisibleSize());
    },

    /**
     * Get design resolution size.
     * Default resolution size is the same as 'getFrameSize'.
     * @return {cc.Size}
     */
    getDesignResolutionSize: function () {
        return cc.size(this._designResolutionSize.width, this._designResolutionSize.height);
    },

    /**
     * Set opengl view port rectangle with points.
     * @param {Number} x
     * @param {Number} y
     * @param {Number} w width
     * @param {Number} h height
     */
    setViewPortInPoints: function (x, y, w, h) {
        var locFrameZoomFactor = this._frameZoomFactor, locScaleX = this._scaleX, locScaleY = this._scaleY;
        cc._renderContext.viewport((x * locScaleX * locFrameZoomFactor + this._viewPortRect.x * locFrameZoomFactor),
            (y * locScaleY * locFrameZoomFactor + this._viewPortRect.y * locFrameZoomFactor),
            (w * locScaleX * locFrameZoomFactor),
            (h * locScaleY * locFrameZoomFactor));
    },

    /**
     * Set Scissor rectangle with points.
     * @param {Number} x
     * @param {Number} y
     * @param {Number} w
     * @param {Number} h
     */
    setScissorInPoints: function (x, y, w, h) {
        var locFrameZoomFactor = this._frameZoomFactor, locScaleX = this._scaleX, locScaleY = this._scaleY;
        cc._renderContext.scissor((x * locScaleX * locFrameZoomFactor + this._viewPortRect.x * locFrameZoomFactor),
            (y * locScaleY * locFrameZoomFactor + this._viewPortRect.y * locFrameZoomFactor),
            (w * locScaleX * locFrameZoomFactor),
            (h * locScaleY * locFrameZoomFactor));
    },

    /**
     * Get whether GL_SCISSOR_TEST is enable
     */
    isScissorEnabled: function () {
        var gl = cc._renderContext;
        return gl.isEnabled(gl.SCISSOR_TEST);
    },

    /**
     * Get the current scissor rectangle
     * @return {cc.Rect}
     */
    getScissorRect: function () {
        var gl = cc._renderContext, scaleX = this._scaleX, scaleY = this._scaleY;
        var boxArr = gl.getParameter(gl.SCISSOR_BOX);
        return cc.rect((boxArr[0] - this._viewPortRect.x) / scaleX, (boxArr[1] - this._viewPortRect.y) / scaleY,
            boxArr[2] / scaleX, boxArr[3] / scaleY);
    },

    /**
     * @param {String} viewName
     */
    setViewName: function (viewName) {
        if (viewName != null && viewName.length > 0) {
            this._viewName = viewName;
        }
    },

    /**
     * get view name
     * @return {String}
     */
    getViewName: function () {
        return this._viewName;
    },

    /**
     * Get the opengl view port rectangle.
     */
    getViewPortRect: function () {
        return this._viewPortRect;
    },

    /**
     * Get scale factor of the horizontal direction.
     */
    getScaleX: function () {
        return this._scaleX;
    },

    /**
     * Get scale factor of the vertical direction.
     */
    getScaleY: function () {
        return this._scaleY;
    },

    /**
     * Get device pixel ratio for retina display.
     */
    getDevicePixelRatio: function() {
        return this._devicePixelRatio;
    },

    /**
     * Get the real location in view
     */
    convertToLocationInView: function (tx, ty, relatedPos) {
        return {x: this._devicePixelRatio * (tx - relatedPos.left), y: this._devicePixelRatio * (relatedPos.top + relatedPos.height - ty)};
    },

    _convertMouseToLocationInView: function(point, relatedPos) {
        var locViewPortRect = this._viewPortRect;
        point.x = ((this._devicePixelRatio * (point.x - relatedPos.left)) - locViewPortRect.x) / this._scaleX;
        point.y = (this._devicePixelRatio * (relatedPos.top + relatedPos.height - point.y) - locViewPortRect.y) / this._scaleY;
    },

    _convertTouchesWithScale: function(touches){
        var locViewPortRect = this._viewPortRect, locScaleX = this._scaleX, locScaleY = this._scaleY, selTouch, selPoint, selPrePoint;
        for( var i = 0; i < touches.length; i ++){
            selTouch = touches[i];
            selPoint = selTouch._point, selPrePoint = selTouch._prevPoint;
            selTouch._setPoint((selPoint.x - locViewPortRect.x) / locScaleX,
                (selPoint.y - locViewPortRect.y) / locScaleY);
            selTouch._setPrevPoint((selPrePoint.x - locViewPortRect.x) / locScaleX,
                (selPrePoint.y - locViewPortRect.y) / locScaleY);
        }
    }
});

cc.EGLView._getInstance = function () {
    if (!this._instance) {
        this._instance = this._instance || new cc.EGLView();
        this._instance.initialize();
    }
    return this._instance;
};

/**
 * <p>cc.ContainerStrategy class is the root strategy class of container's scale strategy,
 * it controls the behavior of how to scale the cc.container and cc._canvas object</p>
 *
 * @class
 * @extends cc.Class
 */
cc.ContainerStrategy = cc.Class.extend({
    // Adjust canvas's size for retina display
    _adjustRetina: false,

    /**
     * Manipulation before appling the strategy
     * @param {cc.EGLView} The target view
     */
    preApply: function (view) {
        var sys = cc.sys;
        this._adjustRetina = sys.os == sys.OS_IOS || sys.os == sys.OS_OSX
    },

    /**
     * Function to apply this strategy
     * @param {cc.EGLView} view
     * @param {cc.Size} designedResolution
     */
    apply: function (view, designedResolution) {
    },

    /**
     * Manipulation after applying the strategy
     * @param {cc.EGLView} view  The target view
     */
    postApply: function (view) {

    },

    _setupContainer: function (view, w, h) {
        var frame = view._frame;
        if (cc.sys.isMobile && frame == document.documentElement) {
            // Automatically full screen when user touches on mobile version
            cc.screen.autoFullScreen(frame);
        }

        var locCanvasElement = cc._canvas, locContainer = cc.container;
        // Setup container
        locContainer.style.width = locCanvasElement.style.width = w + "px";
        locContainer.style.height = locCanvasElement.style.height = h + "px";
        // Setup pixel ratio for retina display
        var devicePixelRatio = view._devicePixelRatio = 1;
        if (this._adjustRetina)
            devicePixelRatio = view._devicePixelRatio = window.devicePixelRatio || 1;
        // Setup canvas
        locCanvasElement.width = w * devicePixelRatio;
        locCanvasElement.height = h * devicePixelRatio;

        var body = document.body, style;
        if (body && (style = body.style)) {
            style.paddingTop = style.paddingTop || "0px";
            style.paddingRight = style.paddingRight || "0px";
            style.paddingBottom = style.paddingBottom || "0px";
            style.paddingLeft = style.paddingLeft || "0px";
            style.borderTop = style.borderTop || "0px";
            style.borderRight = style.borderRight || "0px";
            style.borderBottom = style.borderBottom || "0px";
            style.borderLeft = style.borderLeft || "0px";
            style.marginTop = style.marginTop || "0px";
            style.marginRight = style.marginRight || "0px";
            style.marginBottom = style.marginBottom || "0px";
            style.marginLeft = style.marginLeft || "0px";
        }
    },

    _fixContainer: function () {
        // Add container to document body
        document.body.insertBefore(cc.container, document.body.firstChild);
        // Set body's width height to window's size, and forbid overflow, so that game will be centered
        var bs = document.body.style;
        bs.width = window.innerWidth + "px";
        bs.height = window.innerHeight + "px";
        bs.overflow = "hidden";
        // Body size solution doesn't work on all mobile browser so this is the aleternative: fixed container
        var contStyle = cc.container.style;
        contStyle.position = "fixed";
        contStyle.left = contStyle.top = "0px";
        // Reposition body
        document.body.scrollTop = 0;
    }
});

/**
 * <p>cc.ContentStrategy class is the root strategy class of content's scale strategy,
 * it controls the behavior of how to scale the scene and setup the viewport for the game</p>
 *
 * @class
 * @extends cc.Class
 */
cc.ContentStrategy = cc.Class.extend({

    _result: {
        scale: [1, 1],
        viewport: null
    },

    _buildResult: function (containerW, containerH, contentW, contentH, scaleX, scaleY) {
	    // Makes content fit better the canvas
	    Math.abs(containerW - contentW) < 2 && (contentW = containerW);
	    Math.abs(containerH - contentH) < 2 && (contentH = containerH);

        var viewport = cc.rect(Math.round((containerW - contentW) / 2),
                               Math.round((containerH - contentH) / 2),
                               contentW, contentH);

        // Translate the content
        if (cc._renderType == cc._RENDER_TYPE_CANVAS)
            cc._renderContext.translate(viewport.x, viewport.y + contentH);

        this._result.scale = [scaleX, scaleY];
        this._result.viewport = viewport;
        return this._result;
    },

    /**
     * Manipulation before applying the strategy
     * @param {cc.EGLView} view The target view
     */
    preApply: function (view) {
    },

    /**
     * Function to apply this strategy
     * The return value is {scale: [scaleX, scaleY], viewport: {cc.Rect}},
     * The target view can then apply these value to itself, it's preferred not to modify directly its private variables
     * @param {cc.EGLView} view
     * @param {cc.Size} designedResolution
     * @return {object} scaleAndViewportRect
     */
    apply: function (view, designedResolution) {
        return {"scale": [1, 1]};
    },

    /**
     * Manipulation after applying the strategy
     * @param {cc.EGLView} view The target view
     */
    postApply: function (view) {
    }
});

(function () {

// Container scale strategys
    var EqualToFrame = cc.ContainerStrategy.extend({
        apply: function (view) {
            this._setupContainer(view, view._frameSize.width, view._frameSize.height);
        }
    });

    var ProportionalToFrame = cc.ContainerStrategy.extend({
        apply: function (view, designedResolution) {
            var frameW = view._frameSize.width, frameH = view._frameSize.height, containerStyle = cc.container.style,
                designW = designedResolution.width, designH = designedResolution.height,
                scaleX = frameW / designW, scaleY = frameH / designH,
                containerW, containerH;

            scaleX < scaleY ? (containerW = frameW, containerH = designH * scaleX) : (containerW = designW * scaleY, containerH = frameH);

            // Adjust container size with integer value
            var offx = Math.round((frameW - containerW) / 2);
            var offy = Math.round((frameH - containerH) / 2);
            containerW = frameW - 2 * offx;
            containerH = frameH - 2 * offy;

            this._setupContainer(view, containerW, containerH);
            // Setup container's margin
            containerStyle.marginLeft = offx + "px";
            containerStyle.marginRight = offx + "px";
            containerStyle.marginTop = offy + "px";
            containerStyle.marginBottom = offy + "px";
        }
    });

    var EqualToWindow = EqualToFrame.extend({
        preApply: function (view) {
	        this._super(view);
            view._frame = document.documentElement;
        },

        apply: function (view) {
            this._super(view);
            this._fixContainer();
        }
    });

    var ProportionalToWindow = ProportionalToFrame.extend({
        preApply: function (view) {
	        this._super(view);
            view._frame = document.documentElement;
        },

        apply: function (view, designedResolution) {
            this._super(view, designedResolution);
            this._fixContainer();
        }
    });

    var OriginalContainer = cc.ContainerStrategy.extend({
        apply: function (view) {
            this._setupContainer(view, cc._canvas.width, cc._canvas.height);
        }
    });

// #NOT STABLE on Android# Alias: Strategy that makes the container's size equals to the window's size
//    cc.ContainerStrategy.EQUAL_TO_WINDOW = new EqualToWindow();
// #NOT STABLE on Android# Alias: Strategy that scale proportionally the container's size to window's size
//    cc.ContainerStrategy.PROPORTION_TO_WINDOW = new ProportionalToWindow();
// Alias: Strategy that makes the container's size equals to the frame's size
    cc.ContainerStrategy.EQUAL_TO_FRAME = new EqualToFrame();
// Alias: Strategy that scale proportionally the container's size to frame's size
    cc.ContainerStrategy.PROPORTION_TO_FRAME = new ProportionalToFrame();
// Alias: Strategy that keeps the original container's size
    cc.ContainerStrategy.ORIGINAL_CONTAINER = new OriginalContainer();

// Content scale strategys
    var ExactFit = cc.ContentStrategy.extend({
        apply: function (view, designedResolution) {
            var containerW = cc._canvas.width, containerH = cc._canvas.height,
                scaleX = containerW / designedResolution.width, scaleY = containerH / designedResolution.height;

            return this._buildResult(containerW, containerH, containerW, containerH, scaleX, scaleY);
        }
    });

    var ShowAll = cc.ContentStrategy.extend({
        apply: function (view, designedResolution) {
            var containerW = cc._canvas.width, containerH = cc._canvas.height,
                designW = designedResolution.width, designH = designedResolution.height,
                scaleX = containerW / designW, scaleY = containerH / designH, scale = 0,
                contentW, contentH;

	        scaleX < scaleY ? (scale = scaleX, contentW = containerW, contentH = designH * scale)
                : (scale = scaleY, contentW = designW * scale, contentH = containerH);

            return this._buildResult(containerW, containerH, contentW, contentH, scale, scale);
        }
    });

    var NoBorder = cc.ContentStrategy.extend({
        apply: function (view, designedResolution) {
            var containerW = cc._canvas.width, containerH = cc._canvas.height,
                designW = designedResolution.width, designH = designedResolution.height,
                scaleX = containerW / designW, scaleY = containerH / designH, scale,
                contentW, contentH;

            scaleX < scaleY ? (scale = scaleY, contentW = designW * scale, contentH = containerH)
                : (scale = scaleX, contentW = containerW, contentH = designH * scale);

            return this._buildResult(containerW, containerH, contentW, contentH, scale, scale);
        }
    });

    var FixedHeight = cc.ContentStrategy.extend({
        apply: function (view, designedResolution) {
            var containerW = cc._canvas.width, containerH = cc._canvas.height,
                designH = designedResolution.height, scale = containerH / designH,
                contentW = containerW, contentH = containerH;

            return this._buildResult(containerW, containerH, contentW, contentH, scale, scale);
        },

        postApply: function (view) {
            cc.director._winSizeInPoints = view.getVisibleSize();
        }
    });

    var FixedWidth = cc.ContentStrategy.extend({
        apply: function (view, designedResolution) {
            var containerW = cc._canvas.width, containerH = cc._canvas.height,
                designW = designedResolution.width, scale = containerW / designW,
                contentW = containerW, contentH = containerH;

            return this._buildResult(containerW, containerH, contentW, contentH, scale, scale);
        },

        postApply: function (view) {
            cc.director._winSizeInPoints = view.getVisibleSize();
        }
    });

// Alias: Strategy to scale the content's size to container's size, non proportional
    cc.ContentStrategy.EXACT_FIT = new ExactFit();
// Alias: Strategy to scale the content's size proportionally to maximum size and keeps the whole content area to be visible
    cc.ContentStrategy.SHOW_ALL = new ShowAll();
// Alias: Strategy to scale the content's size proportionally to fill the whole container area
    cc.ContentStrategy.NO_BORDER = new NoBorder();
// Alias: Strategy to scale the content's height to container's height and proportionally scale its width
    cc.ContentStrategy.FIXED_HEIGHT = new FixedHeight();
// Alias: Strategy to scale the content's width to container's width and proportionally scale its height
    cc.ContentStrategy.FIXED_WIDTH = new FixedWidth();

})();

/**
 * <p>cc.ResolutionPolicy class is the root strategy class of scale strategy,
 * its main task is to maintain the compatibility with Cocos2d-x</p>
 *
 * @class
 * @extends cc.Class
 */
cc.ResolutionPolicy = cc.Class.extend({
	_containerStrategy: null,
    _contentStrategy: null,

    ctor: function (containerStg, contentStg) {
        this.setContainerStrategy(containerStg);
        this.setContentStrategy(contentStg);
    },

    /**
     * Manipulation before applying the resolution policy
     * @param {cc.EGLView} view The target view
     */
    preApply: function (view) {
        this._containerStrategy.preApply(view);
        this._contentStrategy.preApply(view);
    },

    /**
     * Function to apply this resolution policy
     * The return value is {scale: [scaleX, scaleY], viewport: {cc.Rect}},
     * The target view can then apply these value to itself, it's preferred not to modify directly its private variables
     * @param {cc.EGLView} view The target view
     * @param {cc.Size} designedResolution The user defined design resolution
     * @return {object} An object contains the scale X/Y values and the viewport rect
     */
    apply: function (view, designedResolution) {
        this._containerStrategy.apply(view, designedResolution);
        return this._contentStrategy.apply(view, designedResolution);
    },

    /**
     * Manipulation after appyling the strategy
     * @param {cc.EGLView} view The target view
     */
    postApply: function (view) {
        this._containerStrategy.postApply(view);
        this._contentStrategy.postApply(view);
    },

    /**
     * Setup the container's scale strategy
     * @param {cc.ContainerStrategy} containerStg
     */
    setContainerStrategy: function (containerStg) {
        if (containerStg instanceof cc.ContainerStrategy)
            this._containerStrategy = containerStg;
    },

    /**
     * Setup the content's scale strategy
     * @param {cc.ContentStrategy} contentStg
     */
    setContentStrategy: function (contentStg) {
        if (contentStg instanceof cc.ContentStrategy)
            this._contentStrategy = contentStg;
    }
});

/*
 * @public
 * @const
 * The entire application is visible in the specified area without trying to preserve the original aspect ratio.<br/>
 * Distortion can occur, and the application may appear stretched or compressed.
 */
cc.ResolutionPolicy.EXACT_FIT = 0;

/*
 * @public
 * @const
 * The entire application fills the specified area, without distortion but possibly with some cropping,<br/>
 * while maintaining the original aspect ratio of the application.
 */
cc.ResolutionPolicy.NO_BORDER = 1;

/*
 * @public
 * @const
 * The entire application is visible in the specified area without distortion while maintaining the original<br/>
 * aspect ratio of the application. Borders can appear on two sides of the application.
 */
cc.ResolutionPolicy.SHOW_ALL = 2;

/*
 * @public
 * @const
 * The application takes the height of the design resolution size and modifies the width of the internal<br/>
 * canvas so that it fits the aspect ratio of the device<br/>
 * no distortion will occur however you must make sure your application works on different<br/>
 * aspect ratios
 */
cc.ResolutionPolicy.FIXED_HEIGHT = 3;

/*
 * @public
 * @const
 * The application takes the width of the design resolution size and modifies the height of the internal<br/>
 * canvas so that it fits the aspect ratio of the device<br/>
 * no distortion will occur however you must make sure your application works on different<br/>
 * aspect ratios
 */
cc.ResolutionPolicy.FIXED_WIDTH = 4;

/*
 * @public
 * @const
 * Unknow policy
 */
cc.ResolutionPolicy.UNKNOWN = 5;