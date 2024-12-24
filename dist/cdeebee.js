function p(e) {
  return e != null && typeof e == "object" && e["@@functional/placeholder"] === !0;
}
function B(e) {
  return function t(r) {
    return arguments.length === 0 || p(r) ? t : e.apply(this, arguments);
  };
}
function D(e) {
  return function t(r, n) {
    switch (arguments.length) {
      case 0:
        return t;
      case 1:
        return p(r) ? t : B(function(s) {
          return e(r, s);
        });
      default:
        return p(r) && p(n) ? t : p(r) ? B(function(s) {
          return e(s, n);
        }) : p(n) ? B(function(s) {
          return e(r, s);
        }) : e(r, n);
    }
  };
}
function q(e) {
  return function t(r, n, s) {
    switch (arguments.length) {
      case 0:
        return t;
      case 1:
        return p(r) ? t : D(function(i, l) {
          return e(r, i, l);
        });
      case 2:
        return p(r) && p(n) ? t : p(r) ? D(function(i, l) {
          return e(i, n, l);
        }) : p(n) ? D(function(i, l) {
          return e(r, i, l);
        }) : B(function(i) {
          return e(r, n, i);
        });
      default:
        return p(r) && p(n) && p(s) ? t : p(r) && p(n) ? D(function(i, l) {
          return e(i, l, s);
        }) : p(r) && p(s) ? D(function(i, l) {
          return e(i, n, l);
        }) : p(n) && p(s) ? D(function(i, l) {
          return e(r, i, l);
        }) : p(r) ? B(function(i) {
          return e(i, n, s);
        }) : p(n) ? B(function(i) {
          return e(r, i, s);
        }) : p(s) ? B(function(i) {
          return e(r, n, i);
        }) : e(r, n, s);
    }
  };
}
const W = Array.isArray || function(t) {
  return t != null && t.length >= 0 && Object.prototype.toString.call(t) === "[object Array]";
};
function F(e, t) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function ae(e) {
  return Object.prototype.toString.call(e) === "[object Object]";
}
const V = Number.isInteger || function(t) {
  return t << 0 === t;
};
function Oe(e, t, r) {
  if (V(e) && W(r)) {
    var n = [].concat(r);
    return n[e] = t, n;
  }
  var s = {};
  for (var i in r)
    s[i] = r[i];
  return s[e] = t, s;
}
var De = /* @__PURE__ */ B(function(t) {
  return t == null;
}), N = /* @__PURE__ */ q(function e(t, r, n) {
  if (t.length === 0)
    return r;
  var s = t[0];
  if (t.length > 1) {
    var i = !De(n) && F(s, n) && typeof n[s] == "object" ? n[s] : V(t[1]) ? [] : {};
    r = e(Array.prototype.slice.call(t, 1), r, i);
  }
  return Oe(s, r, n);
}), Pe = /* @__PURE__ */ q(function(t, r, n) {
  return N([t], r, n);
});
function Be(e, t) {
  return function() {
    var r = arguments.length;
    if (r === 0)
      return t();
    var n = arguments[r - 1];
    return W(n) || typeof n[e] != "function" ? t.apply(this, arguments) : n[e].apply(n, Array.prototype.slice.call(arguments, 0, r - 1));
  };
}
var Se = /* @__PURE__ */ q(/* @__PURE__ */ Be("slice", function(t, r, n) {
  return Array.prototype.slice.call(n, t, r);
})), Ce = /* @__PURE__ */ q(function(t, r, n) {
  var s = Array.prototype.slice.call(n, 0);
  return s.splice(t, r), s;
});
function Ie(e, t) {
  if (t == null)
    return t;
  if (V(e) && W(t))
    return Ce(e, 1, t);
  var r = {};
  for (var n in t)
    r[n] = t[n];
  return delete r[e], r;
}
function Ne(e, t) {
  if (V(e) && W(t))
    return [].concat(t);
  var r = {};
  for (var n in t)
    r[n] = t[n];
  return r;
}
var Ue = /* @__PURE__ */ D(function e(t, r) {
  if (r == null)
    return r;
  switch (t.length) {
    case 0:
      return r;
    case 1:
      return Ie(t[0], r);
    default:
      var n = t[0], s = Array.prototype.slice.call(t, 1);
      return r[n] == null ? Ne(n, r) : Pe(n, e(s, r[n]), r);
  }
}), ue = /* @__PURE__ */ D(function(t, r) {
  return Ue([t], r);
}), Le = /* @__PURE__ */ q(function(t, r, n) {
  var s = {}, i;
  r = r || {}, n = n || {};
  for (i in r)
    F(i, r) && (s[i] = F(i, n) ? t(i, r[i], n[i]) : r[i]);
  for (i in n)
    F(i, n) && !F(i, s) && (s[i] = n[i]);
  return s;
}), qe = /* @__PURE__ */ q(function e(t, r, n) {
  return Le(function(s, i, l) {
    return ae(i) && ae(l) ? e(t, i, l) : t(s, i, l);
  }, r, n);
}), $ = /* @__PURE__ */ D(function(t, r) {
  return qe(function(n, s, i) {
    return i;
  }, t, r);
}), ne = /* @__PURE__ */ D(function(t, r) {
  for (var n = {}, s = {}, i = 0, l = t.length; i < l; )
    s[t[i]] = 1, i += 1;
  for (var v in r)
    s.hasOwnProperty(v) || (n[v] = r[v]);
  return n;
}), y = /* @__PURE__ */ ((e) => (e.CDEEBEE_REQUESTMANAGER_SHIFT = "@@cdeebee/REQUESTMANAGER_SHIFT", e.CDEEBEE_REQUESTMANAGER_SET = "@@cdeebee/REQUESTMANAGER_SET", e.CDEEBEE_ERRORHANDLER_SET = "@@cdeebee/ERRORHANDLER_SET", e.CDEEBEE_ENTITY_CHANGE_FIELD = "@@cdeebee/ENTITY_CHANGE_FIELD", e.CDEEBEE_ENTITY_UNSAFE_UPDATE_STORE = "@@cdeebee/ENTITY_UNSAFE_UPDATE_STORE", e.CDEEBEE_RESET_ENTITY = "@@cdeebee/RESET_ENTITY", e.CDEEBEE_SET_ENTITY = "@@cdeebee/SET_ENTITY", e.CDEEBEEE_UPDATE = "@@cdeebee/UPDATE", e.CDEEBEEE_DROP = "@@cdeebee/DROP", e.CDEEBEEE_DROP_PATH = "@@cdeebee/DROP_PATH", e.CDEEBEE_INTERNAL_ERROR = "@@cdeebee/INTERNAL_ERROR", e.CDEEBEE_REQUEST_ABORTED = "@@cdeebee/REQUEST_ABORTED", e.CDEEBEEE_DROP_REQUEST_BY_API_URL = "@@cdeebee/DROP_REQUEST_BY_API_URL", e.CDEEBEEE_DROP_ERROR_BY_API_URL = "@@cdeebee/DROP_ERROR_BY_API_URL", e.CHANGE_ROUTE = "@@router/LOCATION_CHANGE", e))(y || {}), U = /* @__PURE__ */ ((e) => (e.NEW = "NEW", e.EDITING = "EDITING", e.NORMAL = "NORMAL", e))(U || {}), pe = /* @__PURE__ */ ((e) => (e.merge = "merge", e.replace = "replace", e))(pe || {});
const de = (e) => ne(["__entity", "__state"], e), he = (e) => e.filter((t) => t.requestCancel ? (_e(t), !1) : !0), _e = (e) => {
  e.controller && e.controller.abort instanceof Function && e.controller.abort();
}, je = (e, t) => {
  if (!t || e.length === 0)
    return !1;
  const r = t instanceof Array ? t : [t], n = e.map((s) => s.api);
  for (let s = 0; s < r.length; s += 1)
    if (n.includes(r[s]))
      return !0;
  return !1;
}, He = (e) => Object.prototype.hasOwnProperty.call(e, "__entity") ? e.__entity : e, X = (e) => {
  var r;
  const t = ((r = e == null ? void 0 : e.__entity) == null ? void 0 : r.__state) || (e == null ? void 0 : e.__state);
  return t || U.NORMAL;
}, xe = (e) => (e.__state = U.NEW, e), ke = (e) => X(e) === U.NORMAL ? (console.warn("commit works only in editing and new states"), e) : de(e), be = (e) => X(e) === U.NORMAL ? (console.warn("reset works only in editing and new states"), e) : de(e), ve = (e, t, r) => {
  const n = e[t];
  if (X(n[r]) === U.EDITING)
    return e;
  const i = N([t, r, "__entity"], n[r], e);
  return N([t, r, "__entity", "__state"], U.EDITING, i);
}, me = (e, t, r) => {
  const n = r || [];
  let s = e;
  for (let i = 0; i < t.length; i++) {
    const l = t[i];
    s = N([...n, ...l.key], l.value, s);
  }
  return s;
}, Ae = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  response: { responseStatus: e, ...t },
  cdeebee: r,
  mergeListStrategy: n,
  primaryKey: s
}) => {
  const i = Object.keys(t);
  for (const l of i) {
    const v = {};
    if (t[l] instanceof Object && Object.prototype.hasOwnProperty.call(t[l], s)) {
      for (const R of t[l].data)
        v[R[t[l][s]]] = R;
      n[l] === pe.replace ? t[l] = v : t[l] = $(r[l], v);
    } else (t[l] === null || t[l] === void 0 || typeof t[l] == "string") && (t = ne([l], t));
  }
  return t;
}, ut = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  batchingUpdate: me,
  checkNetworkActivity: je,
  commitEntity: ke,
  defaultNormalize: Ae,
  dropRequestFromArray: he,
  editEntity: ve,
  getEntityState: X,
  getSubEntity: He,
  insertEntity: xe,
  requestCancel: _e,
  resetEntity: be
}, Symbol.toStringTag, { value: "Module" })), ce = {}, ct = (e = ce, t) => {
  const { type: r, payload: n } = t;
  switch (r) {
    case y.CDEEBEEE_UPDATE:
      return { ...e, ...n.response };
    case y.CDEEBEE_ENTITY_CHANGE_FIELD: {
      const s = ve(e, n.entityList, n.entityID);
      return me(s, n.valueList, [n.entityList, n.entityID, "__entity"]);
    }
    case y.CDEEBEE_ENTITY_UNSAFE_UPDATE_STORE:
      return N([n.entityList, n.entityID], n.value, e);
    case y.CDEEBEE_SET_ENTITY:
      return N([n.entityList, n.entityID], n.entity, e);
    case y.CDEEBEE_RESET_ENTITY: {
      const s = e[n.entityList];
      return N(
        [n.entityList, n.entityID],
        be(s[n.entityID]),
        e
      );
    }
    case y.CDEEBEEE_DROP:
      return ce;
    case y.CDEEBEEE_DROP_PATH:
      return ne(n.path, e);
    default:
      return e;
  }
}, le = {
  activeRequest: [],
  requestByApiUrl: {},
  errorHandler: {}
}, lt = (e = le, t) => {
  const { type: r, payload: n } = t;
  switch (r) {
    case y.CDEEBEE_REQUESTMANAGER_SET:
      return { ...e, activeRequest: [...e.activeRequest, n] };
    case y.CDEEBEE_REQUESTMANAGER_SHIFT:
      return { ...e, activeRequest: Se(1, 1 / 0, e.activeRequest) };
    case y.CDEEBEEE_UPDATE:
      return {
        ...e,
        requestByApiUrl: {
          ...e.requestByApiUrl,
          [n.api]: n.cleanResponse
        }
      };
    case y.CDEEBEEE_DROP_REQUEST_BY_API_URL:
      return {
        ...e,
        requestByApiUrl: ue(n.api, e.requestByApiUrl)
      };
    case y.CDEEBEEE_DROP_ERROR_BY_API_URL:
      return {
        ...e,
        errorHandler: ue(n.api, e.errorHandler)
      };
    case y.CDEEBEE_ERRORHANDLER_SET:
      return {
        ...e,
        errorHandler: {
          ...e.errorHandler,
          [n.api]: n.cleanResponse
        }
      };
    case y.CDEEBEE_INTERNAL_ERROR:
      return { ...e, activeRequest: [], requestByApiUrl: {} };
    case y.CHANGE_ROUTE:
      return { ...le, activeRequest: he(e.activeRequest) };
    default:
      return e;
  }
};
var Fe = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, fe = {}, Ee;
function Me() {
  return Ee || (Ee = 1, function(e) {
    e();
  }(function() {
    function e(o, a) {
      (a == null || a > o.length) && (a = o.length);
      for (var u = 0, c = Array(a); u < a; u++) c[u] = o[u];
      return c;
    }
    function t(o) {
      if (o === void 0) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
      return o;
    }
    function r(o, a, u) {
      return a = R(a), H(o, g() ? Reflect.construct(a, [], R(o).constructor) : a.apply(o, u));
    }
    function n(o, a) {
      if (!(o instanceof a)) throw new TypeError("Cannot call a class as a function");
    }
    function s(o, a) {
      for (var u = 0; u < a.length; u++) {
        var c = a[u];
        c.enumerable = c.enumerable || !1, c.configurable = !0, "value" in c && (c.writable = !0), Object.defineProperty(o, Z(c.key), c);
      }
    }
    function i(o, a, u) {
      return a && s(o.prototype, a), u && s(o, u), Object.defineProperty(o, "prototype", {
        writable: !1
      }), o;
    }
    function l(o, a) {
      var u = typeof Symbol < "u" && o[Symbol.iterator] || o["@@iterator"];
      if (!u) {
        if (Array.isArray(o) || (u = Y(o)) || a) {
          u && (o = u);
          var c = 0, E = function() {
          };
          return {
            s: E,
            n: function() {
              return c >= o.length ? {
                done: !0
              } : {
                done: !1,
                value: o[c++]
              };
            },
            e: function(f) {
              throw f;
            },
            f: E
          };
        }
        throw new TypeError(`Invalid attempt to iterate non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
      }
      var h, T = !0, b = !1;
      return {
        s: function() {
          u = u.call(o);
        },
        n: function() {
          var f = u.next();
          return T = f.done, f;
        },
        e: function(f) {
          b = !0, h = f;
        },
        f: function() {
          try {
            T || u.return == null || u.return();
          } finally {
            if (b) throw h;
          }
        }
      };
    }
    function v() {
      return v = typeof Reflect < "u" && Reflect.get ? Reflect.get.bind() : function(o, a, u) {
        var c = M(o, a);
        if (c) {
          var E = Object.getOwnPropertyDescriptor(c, a);
          return E.get ? E.get.call(arguments.length < 3 ? o : u) : E.value;
        }
      }, v.apply(null, arguments);
    }
    function R(o) {
      return R = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(a) {
        return a.__proto__ || Object.getPrototypeOf(a);
      }, R(o);
    }
    function d(o, a) {
      if (typeof a != "function" && a !== null) throw new TypeError("Super expression must either be null or a function");
      o.prototype = Object.create(a && a.prototype, {
        constructor: {
          value: o,
          writable: !0,
          configurable: !0
        }
      }), Object.defineProperty(o, "prototype", {
        writable: !1
      }), a && S(o, a);
    }
    function g() {
      try {
        var o = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
        }));
      } catch {
      }
      return (g = function() {
        return !!o;
      })();
    }
    function H(o, a) {
      if (a && (typeof a == "object" || typeof a == "function")) return a;
      if (a !== void 0) throw new TypeError("Derived constructors may only return object or undefined");
      return t(o);
    }
    function S(o, a) {
      return S = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(u, c) {
        return u.__proto__ = c, u;
      }, S(o, a);
    }
    function M(o, a) {
      for (; !{}.hasOwnProperty.call(o, a) && (o = R(o)) !== null; ) ;
      return o;
    }
    function J(o, a, u, c) {
      var E = v(R(o.prototype), a, u);
      return typeof E == "function" ? function(h) {
        return E.apply(u, h);
      } : E;
    }
    function G(o, a) {
      if (typeof o != "object" || !o) return o;
      var u = o[Symbol.toPrimitive];
      if (u !== void 0) {
        var c = u.call(o, a);
        if (typeof c != "object") return c;
        throw new TypeError("@@toPrimitive must return a primitive value.");
      }
      return String(o);
    }
    function Z(o) {
      var a = G(o, "string");
      return typeof a == "symbol" ? a : a + "";
    }
    function Y(o, a) {
      if (o) {
        if (typeof o == "string") return e(o, a);
        var u = {}.toString.call(o).slice(8, -1);
        return u === "Object" && o.constructor && (u = o.constructor.name), u === "Map" || u === "Set" ? Array.from(o) : u === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(u) ? e(o, a) : void 0;
      }
    }
    function ee(o) {
      var a;
      try {
        a = new Event("abort");
      } catch {
        typeof document < "u" ? document.createEvent ? (a = document.createEvent("Event"), a.initEvent("abort", !1, !1)) : (a = document.createEventObject(), a.type = "abort") : a = {
          type: "abort",
          bubbles: !1,
          cancelable: !1
        };
      }
      return a.reason = o, a;
    }
    function te(o) {
      if (o === void 0)
        if (typeof document > "u")
          o = new Error("This operation was aborted"), o.name = "AbortError";
        else
          try {
            o = new DOMException("signal is aborted without reason"), Object.defineProperty(o, "name", {
              value: "AbortError"
            });
          } catch {
            o = new Error("This operation was aborted"), o.name = "AbortError";
          }
      return o;
    }
    var K = /* @__PURE__ */ function() {
      function o() {
        n(this, o), Object.defineProperty(this, "listeners", {
          value: {},
          writable: !0,
          configurable: !0
        });
      }
      return i(o, [{
        key: "addEventListener",
        value: function(u, c, E) {
          u in this.listeners || (this.listeners[u] = []), this.listeners[u].push({
            callback: c,
            options: E
          });
        }
      }, {
        key: "removeEventListener",
        value: function(u, c) {
          if (u in this.listeners) {
            for (var E = this.listeners[u], h = 0, T = E.length; h < T; h++)
              if (E[h].callback === c) {
                E.splice(h, 1);
                return;
              }
          }
        }
      }, {
        key: "dispatchEvent",
        value: function(u) {
          var c = this;
          if (u.type in this.listeners) {
            for (var E = this.listeners[u.type], h = E.slice(), T = function() {
              var O = h[b];
              try {
                O.callback.call(c, u);
              } catch (z) {
                Promise.resolve().then(function() {
                  throw z;
                });
              }
              O.options && O.options.once && c.removeEventListener(u.type, O.callback);
            }, b = 0, f = h.length; b < f; b++)
              T();
            return !u.defaultPrevented;
          }
        }
      }]);
    }(), x = /* @__PURE__ */ function(o) {
      function a() {
        var u;
        return n(this, a), u = r(this, a), u.listeners || K.call(u), Object.defineProperty(u, "aborted", {
          value: !1,
          writable: !0,
          configurable: !0
        }), Object.defineProperty(u, "onabort", {
          value: null,
          writable: !0,
          configurable: !0
        }), Object.defineProperty(u, "reason", {
          value: void 0,
          writable: !0,
          configurable: !0
        }), u;
      }
      return d(a, o), i(a, [{
        key: "toString",
        value: function() {
          return "[object AbortSignal]";
        }
      }, {
        key: "dispatchEvent",
        value: function(c) {
          c.type === "abort" && (this.aborted = !0, typeof this.onabort == "function" && this.onabort.call(this, c)), J(a, "dispatchEvent", this)([c]);
        }
        /**
         * @see {@link https://developer.mozilla.org/zh-CN/docs/Web/API/AbortSignal/throwIfAborted}
         */
      }, {
        key: "throwIfAborted",
        value: function() {
          var c = this.aborted, E = this.reason, h = E === void 0 ? "Aborted" : E;
          if (c)
            throw h;
        }
        /**
         * @see {@link https://developer.mozilla.org/zh-CN/docs/Web/API/AbortSignal/timeout_static}
         * @param {number} time The "active" time in milliseconds before the returned {@link AbortSignal} will abort.
         *                      The value must be within range of 0 and {@link Number.MAX_SAFE_INTEGER}.
         * @returns {AbortSignal} The signal will abort with its {@link AbortSignal.reason} property set to a `TimeoutError` {@link DOMException} on timeout,
         *                        or an `AbortError` {@link DOMException} if the operation was user-triggered.
         */
      }], [{
        key: "timeout",
        value: function(c) {
          var E = new C();
          return setTimeout(function() {
            return E.abort(new DOMException("This signal is timeout in ".concat(c, "ms"), "TimeoutError"));
          }, c), E.signal;
        }
        /**
         * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static}
         * @param {Iterable<AbortSignal>} iterable An {@link Iterable} (such as an {@link Array}) of abort signals.
         * @returns {AbortSignal} - **Already aborted**, if any of the abort signals given is already aborted.
         *                          The returned {@link AbortSignal}'s reason will be already set to the `reason` of the first abort signal that was already aborted.
         *                        - **Asynchronously aborted**, when any abort signal in `iterable` aborts.
         *                          The `reason` will be set to the reason of the first abort signal that is aborted.
         */
      }, {
        key: "any",
        value: function(c) {
          var E = new C();
          function h() {
            E.abort(this.reason), T();
          }
          function T() {
            var O = l(c), z;
            try {
              for (O.s(); !(z = O.n()).done; ) {
                var Te = z.value;
                Te.removeEventListener("abort", h);
              }
            } catch (we) {
              O.e(we);
            } finally {
              O.f();
            }
          }
          var b = l(c), f;
          try {
            for (b.s(); !(f = b.n()).done; ) {
              var Q = f.value;
              if (Q.aborted) {
                E.abort(Q.reason);
                break;
              } else Q.addEventListener("abort", h);
            }
          } catch (O) {
            b.e(O);
          } finally {
            b.f();
          }
          return E.signal;
        }
      }]);
    }(K), C = /* @__PURE__ */ function() {
      function o() {
        n(this, o), Object.defineProperty(this, "signal", {
          value: new x(),
          writable: !0,
          configurable: !0
        });
      }
      return i(o, [{
        key: "abort",
        value: function(u) {
          var c = te(u), E = ee(c);
          this.signal.reason = c, this.signal.dispatchEvent(E);
        }
      }, {
        key: "toString",
        value: function() {
          return "[object AbortController]";
        }
      }]);
    }();
    typeof Symbol < "u" && Symbol.toStringTag && (C.prototype[Symbol.toStringTag] = "AbortController", x.prototype[Symbol.toStringTag] = "AbortSignal");
    function w(o) {
      return o.__FORCE_INSTALL_ABORTCONTROLLER_POLYFILL ? (console.log("__FORCE_INSTALL_ABORTCONTROLLER_POLYFILL=true is set, will force install polyfill"), !0) : typeof o.Request == "function" && !o.Request.prototype.hasOwnProperty("signal") || !o.AbortController;
    }
    (function(o) {
      w(o) && (o.AbortController = C, o.AbortSignal = x);
    })(typeof self < "u" ? self : Fe);
  })), fe;
}
Me();
var m = typeof globalThis < "u" && globalThis || typeof self < "u" && self || // eslint-disable-next-line no-undef
typeof global < "u" && global || {}, A = {
  searchParams: "URLSearchParams" in m,
  iterable: "Symbol" in m && "iterator" in Symbol,
  blob: "FileReader" in m && "Blob" in m && function() {
    try {
      return new Blob(), !0;
    } catch {
      return !1;
    }
  }(),
  formData: "FormData" in m,
  arrayBuffer: "ArrayBuffer" in m
};
function Ge(e) {
  return e && DataView.prototype.isPrototypeOf(e);
}
if (A.arrayBuffer)
  var Ye = [
    "[object Int8Array]",
    "[object Uint8Array]",
    "[object Uint8ClampedArray]",
    "[object Int16Array]",
    "[object Uint16Array]",
    "[object Int32Array]",
    "[object Uint32Array]",
    "[object Float32Array]",
    "[object Float64Array]"
  ], Ke = ArrayBuffer.isView || function(e) {
    return e && Ye.indexOf(Object.prototype.toString.call(e)) > -1;
  };
function j(e) {
  if (typeof e != "string" && (e = String(e)), /[^a-z0-9\-#$%&'*+.^_`|~!]/i.test(e) || e === "")
    throw new TypeError('Invalid character in header field name: "' + e + '"');
  return e.toLowerCase();
}
function oe(e) {
  return typeof e != "string" && (e = String(e)), e;
}
function ie(e) {
  var t = {
    next: function() {
      var r = e.shift();
      return { done: r === void 0, value: r };
    }
  };
  return A.iterable && (t[Symbol.iterator] = function() {
    return t;
  }), t;
}
function _(e) {
  this.map = {}, e instanceof _ ? e.forEach(function(t, r) {
    this.append(r, t);
  }, this) : Array.isArray(e) ? e.forEach(function(t) {
    if (t.length != 2)
      throw new TypeError("Headers constructor: expected name/value pair to be length 2, found" + t.length);
    this.append(t[0], t[1]);
  }, this) : e && Object.getOwnPropertyNames(e).forEach(function(t) {
    this.append(t, e[t]);
  }, this);
}
_.prototype.append = function(e, t) {
  e = j(e), t = oe(t);
  var r = this.map[e];
  this.map[e] = r ? r + ", " + t : t;
};
_.prototype.delete = function(e) {
  delete this.map[j(e)];
};
_.prototype.get = function(e) {
  return e = j(e), this.has(e) ? this.map[e] : null;
};
_.prototype.has = function(e) {
  return this.map.hasOwnProperty(j(e));
};
_.prototype.set = function(e, t) {
  this.map[j(e)] = oe(t);
};
_.prototype.forEach = function(e, t) {
  for (var r in this.map)
    this.map.hasOwnProperty(r) && e.call(t, this.map[r], r, this);
};
_.prototype.keys = function() {
  var e = [];
  return this.forEach(function(t, r) {
    e.push(r);
  }), ie(e);
};
_.prototype.values = function() {
  var e = [];
  return this.forEach(function(t) {
    e.push(t);
  }), ie(e);
};
_.prototype.entries = function() {
  var e = [];
  return this.forEach(function(t, r) {
    e.push([r, t]);
  }), ie(e);
};
A.iterable && (_.prototype[Symbol.iterator] = _.prototype.entries);
function re(e) {
  if (!e._noBody) {
    if (e.bodyUsed)
      return Promise.reject(new TypeError("Already read"));
    e.bodyUsed = !0;
  }
}
function Re(e) {
  return new Promise(function(t, r) {
    e.onload = function() {
      t(e.result);
    }, e.onerror = function() {
      r(e.error);
    };
  });
}
function Qe(e) {
  var t = new FileReader(), r = Re(t);
  return t.readAsArrayBuffer(e), r;
}
function ze(e) {
  var t = new FileReader(), r = Re(t), n = /charset=([A-Za-z0-9_-]+)/.exec(e.type), s = n ? n[1] : "utf-8";
  return t.readAsText(e, s), r;
}
function $e(e) {
  for (var t = new Uint8Array(e), r = new Array(t.length), n = 0; n < t.length; n++)
    r[n] = String.fromCharCode(t[n]);
  return r.join("");
}
function ye(e) {
  if (e.slice)
    return e.slice(0);
  var t = new Uint8Array(e.byteLength);
  return t.set(new Uint8Array(e)), t.buffer;
}
function ge() {
  return this.bodyUsed = !1, this._initBody = function(e) {
    this.bodyUsed = this.bodyUsed, this._bodyInit = e, e ? typeof e == "string" ? this._bodyText = e : A.blob && Blob.prototype.isPrototypeOf(e) ? this._bodyBlob = e : A.formData && FormData.prototype.isPrototypeOf(e) ? this._bodyFormData = e : A.searchParams && URLSearchParams.prototype.isPrototypeOf(e) ? this._bodyText = e.toString() : A.arrayBuffer && A.blob && Ge(e) ? (this._bodyArrayBuffer = ye(e.buffer), this._bodyInit = new Blob([this._bodyArrayBuffer])) : A.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(e) || Ke(e)) ? this._bodyArrayBuffer = ye(e) : this._bodyText = e = Object.prototype.toString.call(e) : (this._noBody = !0, this._bodyText = ""), this.headers.get("content-type") || (typeof e == "string" ? this.headers.set("content-type", "text/plain;charset=UTF-8") : this._bodyBlob && this._bodyBlob.type ? this.headers.set("content-type", this._bodyBlob.type) : A.searchParams && URLSearchParams.prototype.isPrototypeOf(e) && this.headers.set("content-type", "application/x-www-form-urlencoded;charset=UTF-8"));
  }, A.blob && (this.blob = function() {
    var e = re(this);
    if (e)
      return e;
    if (this._bodyBlob)
      return Promise.resolve(this._bodyBlob);
    if (this._bodyArrayBuffer)
      return Promise.resolve(new Blob([this._bodyArrayBuffer]));
    if (this._bodyFormData)
      throw new Error("could not read FormData body as blob");
    return Promise.resolve(new Blob([this._bodyText]));
  }), this.arrayBuffer = function() {
    if (this._bodyArrayBuffer) {
      var e = re(this);
      return e || (ArrayBuffer.isView(this._bodyArrayBuffer) ? Promise.resolve(
        this._bodyArrayBuffer.buffer.slice(
          this._bodyArrayBuffer.byteOffset,
          this._bodyArrayBuffer.byteOffset + this._bodyArrayBuffer.byteLength
        )
      ) : Promise.resolve(this._bodyArrayBuffer));
    } else {
      if (A.blob)
        return this.blob().then(Qe);
      throw new Error("could not read as ArrayBuffer");
    }
  }, this.text = function() {
    var e = re(this);
    if (e)
      return e;
    if (this._bodyBlob)
      return ze(this._bodyBlob);
    if (this._bodyArrayBuffer)
      return Promise.resolve($e(this._bodyArrayBuffer));
    if (this._bodyFormData)
      throw new Error("could not read FormData body as text");
    return Promise.resolve(this._bodyText);
  }, A.formData && (this.formData = function() {
    return this.text().then(Xe);
  }), this.json = function() {
    return this.text().then(JSON.parse);
  }, this;
}
var We = ["CONNECT", "DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT", "TRACE"];
function Ve(e) {
  var t = e.toUpperCase();
  return We.indexOf(t) > -1 ? t : e;
}
function L(e, t) {
  if (!(this instanceof L))
    throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.');
  t = t || {};
  var r = t.body;
  if (e instanceof L) {
    if (e.bodyUsed)
      throw new TypeError("Already read");
    this.url = e.url, this.credentials = e.credentials, t.headers || (this.headers = new _(e.headers)), this.method = e.method, this.mode = e.mode, this.signal = e.signal, !r && e._bodyInit != null && (r = e._bodyInit, e.bodyUsed = !0);
  } else
    this.url = String(e);
  if (this.credentials = t.credentials || this.credentials || "same-origin", (t.headers || !this.headers) && (this.headers = new _(t.headers)), this.method = Ve(t.method || this.method || "GET"), this.mode = t.mode || this.mode || null, this.signal = t.signal || this.signal || function() {
    if ("AbortController" in m) {
      var i = new AbortController();
      return i.signal;
    }
  }(), this.referrer = null, (this.method === "GET" || this.method === "HEAD") && r)
    throw new TypeError("Body not allowed for GET or HEAD requests");
  if (this._initBody(r), (this.method === "GET" || this.method === "HEAD") && (t.cache === "no-store" || t.cache === "no-cache")) {
    var n = /([?&])_=[^&]*/;
    if (n.test(this.url))
      this.url = this.url.replace(n, "$1_=" + (/* @__PURE__ */ new Date()).getTime());
    else {
      var s = /\?/;
      this.url += (s.test(this.url) ? "&" : "?") + "_=" + (/* @__PURE__ */ new Date()).getTime();
    }
  }
}
L.prototype.clone = function() {
  return new L(this, { body: this._bodyInit });
};
function Xe(e) {
  var t = new FormData();
  return e.trim().split("&").forEach(function(r) {
    if (r) {
      var n = r.split("="), s = n.shift().replace(/\+/g, " "), i = n.join("=").replace(/\+/g, " ");
      t.append(decodeURIComponent(s), decodeURIComponent(i));
    }
  }), t;
}
function Je(e) {
  var t = new _(), r = e.replace(/\r?\n[\t ]+/g, " ");
  return r.split("\r").map(function(n) {
    return n.indexOf(`
`) === 0 ? n.substr(1, n.length) : n;
  }).forEach(function(n) {
    var s = n.split(":"), i = s.shift().trim();
    if (i) {
      var l = s.join(":").trim();
      try {
        t.append(i, l);
      } catch (v) {
        console.warn("Response " + v.message);
      }
    }
  }), t;
}
ge.call(L.prototype);
function P(e, t) {
  if (!(this instanceof P))
    throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.');
  if (t || (t = {}), this.type = "default", this.status = t.status === void 0 ? 200 : t.status, this.status < 200 || this.status > 599)
    throw new RangeError("Failed to construct 'Response': The status provided (0) is outside the range [200, 599].");
  this.ok = this.status >= 200 && this.status < 300, this.statusText = t.statusText === void 0 ? "" : "" + t.statusText, this.headers = new _(t.headers), this.url = t.url || "", this._initBody(e);
}
ge.call(P.prototype);
P.prototype.clone = function() {
  return new P(this._bodyInit, {
    status: this.status,
    statusText: this.statusText,
    headers: new _(this.headers),
    url: this.url
  });
};
P.error = function() {
  var e = new P(null, { status: 200, statusText: "" });
  return e.ok = !1, e.status = 0, e.type = "error", e;
};
var Ze = [301, 302, 303, 307, 308];
P.redirect = function(e, t) {
  if (Ze.indexOf(t) === -1)
    throw new RangeError("Invalid status code");
  return new P(null, { status: t, headers: { location: e } });
};
var I = m.DOMException;
try {
  new I();
} catch {
  I = function(t, r) {
    this.message = t, this.name = r;
    var n = Error(t);
    this.stack = n.stack;
  }, I.prototype = Object.create(Error.prototype), I.prototype.constructor = I;
}
function se(e, t) {
  return new Promise(function(r, n) {
    var s = new L(e, t);
    if (s.signal && s.signal.aborted)
      return n(new I("Aborted", "AbortError"));
    var i = new XMLHttpRequest();
    function l() {
      i.abort();
    }
    i.onload = function() {
      var d = {
        statusText: i.statusText,
        headers: Je(i.getAllResponseHeaders() || "")
      };
      s.url.indexOf("file://") === 0 && (i.status < 200 || i.status > 599) ? d.status = 200 : d.status = i.status, d.url = "responseURL" in i ? i.responseURL : d.headers.get("X-Request-URL");
      var g = "response" in i ? i.response : i.responseText;
      setTimeout(function() {
        r(new P(g, d));
      }, 0);
    }, i.onerror = function() {
      setTimeout(function() {
        n(new TypeError("Network request failed"));
      }, 0);
    }, i.ontimeout = function() {
      setTimeout(function() {
        n(new TypeError("Network request timed out"));
      }, 0);
    }, i.onabort = function() {
      setTimeout(function() {
        n(new I("Aborted", "AbortError"));
      }, 0);
    };
    function v(d) {
      try {
        return d === "" && m.location.href ? m.location.href : d;
      } catch {
        return d;
      }
    }
    if (i.open(s.method, v(s.url), !0), s.credentials === "include" ? i.withCredentials = !0 : s.credentials === "omit" && (i.withCredentials = !1), "responseType" in i && (A.blob ? i.responseType = "blob" : A.arrayBuffer && (i.responseType = "arraybuffer")), t && typeof t.headers == "object" && !(t.headers instanceof _ || m.Headers && t.headers instanceof m.Headers)) {
      var R = [];
      Object.getOwnPropertyNames(t.headers).forEach(function(d) {
        R.push(j(d)), i.setRequestHeader(d, oe(t.headers[d]));
      }), s.headers.forEach(function(d, g) {
        R.indexOf(g) === -1 && i.setRequestHeader(g, d);
      });
    } else
      s.headers.forEach(function(d, g) {
        i.setRequestHeader(g, d);
      });
    s.signal && (s.signal.addEventListener("abort", l), i.onreadystatechange = function() {
      i.readyState === 4 && s.signal.removeEventListener("abort", l);
    }), i.send(typeof s._bodyInit > "u" ? null : s._bodyInit);
  });
}
se.polyfill = !0;
m.fetch || (m.fetch = se, m.Headers = _, m.Request = L, m.Response = P);
let k = {};
const et = typeof window < "u" ? "signal" in new Request("") ? window.fetch : se : fetch;
class ft {
  constructor(t, r) {
    this.send = (n) => async (s, i) => {
      var a, u;
      const {
        api: l,
        preUpdate: v,
        postUpdate: R,
        preError: d,
        postError: g,
        data: H,
        files: S,
        requestCancel: M = !0,
        updateStore: J = !0,
        fileKey: G = this.options.fileKey,
        primaryKey: Z = this.options.primaryKey,
        bodyKey: Y = this.options.bodyKey,
        method: ee = this.options.method,
        normalize: te = this.options.normalize,
        mergeListStrategy: K = this.options.mergeListStrategy,
        headers: x = this.options.headers,
        responseKeyCode: C = this.options.responseKeyCode
      } = $(this.requestObject, n), w = Math.random().toString(36).substr(2), o = /* @__PURE__ */ new Date();
      try {
        let c = JSON.stringify({ ...H, requestID: w });
        const E = new AbortController(), { signal: h } = E;
        if (s({
          type: y.CDEEBEE_REQUESTMANAGER_SET,
          payload: { requestID: w, api: l, controller: E, data: H, requestCancel: M, requestStartTime: o, requestEndTime: void 0 }
        }), S) {
          const b = new FormData();
          for (let f = 0; f < S.length; f += 1)
            G && b.append(G, S[f]);
          Y && b.append(Y, c), c = b;
        }
        const T = await (await et(l, {
          method: ee,
          signal: h,
          headers: { "ui-request-id": w, ...x },
          body: c
        })).json();
        if (T)
          for (k = Object.assign(
            {
              [w]: {
                requestID: w,
                response: T,
                requestApi: l,
                requestStartTime: o,
                preUpdate: v,
                postUpdate: R,
                normalize: te,
                preError: d,
                postError: g,
                mergeListStrategy: K,
                updateStore: J,
                data: H,
                requestCancel: M,
                controller: E
              }
            },
            k
          ); k[(u = (a = i().requestManager.activeRequest) == null ? void 0 : a[0]) == null ? void 0 : u.requestID]; ) {
            const b = i().requestManager.activeRequest[0].requestID, f = k[b];
            C && f.response[C] === 0 ? (f.preUpdate && f.preUpdate(f.response), f.updateStore && s({
              type: y.CDEEBEEE_UPDATE,
              payload: {
                response: f.normalize instanceof Function && f.normalize({
                  response: f.response,
                  cdeebee: i().cdeebee,
                  mergeListStrategy: f.mergeListStrategy,
                  primaryKey: Z
                }),
                cleanResponse: f.response,
                api: f.requestApi,
                mergeListStrategy: f.mergeListStrategy
              }
            }), f.postUpdate && f.postUpdate(f.response)) : (f.preError && f.preError(f.response), s({
              type: y.CDEEBEE_ERRORHANDLER_SET,
              payload: { api: f.requestApi, cleanResponse: f.response }
            }), f.postError && f.postError(T)), s({
              type: y.CDEEBEE_REQUESTMANAGER_SHIFT,
              payload: {
                requestID: f.requestID,
                api: f.requestApi,
                controller: f.controller,
                data: f.data,
                requestCancel: f.requestCancel,
                requestStartTime: f.requestStartTime,
                requestEndTime: /* @__PURE__ */ new Date()
              }
            }), delete k[b];
          }
      } catch (c) {
        if (c.name === "AbortError")
          s({ type: y.CDEEBEE_REQUEST_ABORTED, payload: { requestID: w, api: l } });
        else {
          const E = /* @__PURE__ */ new Date();
          s({
            type: y.CDEEBEE_INTERNAL_ERROR,
            payload: { requestStartTime: o, requestEndTime: E, requestID: w, api: l }
          }), console.warn("@@makeRequest-error", c), console.warn("@@makeRequest-object", $(this.requestObject, n)), console.warn("@@makeRequest-info", { requestStartTime: o, requestEndTime: E, requestID: w }), Object.prototype.hasOwnProperty.call(this.options, "globalErrorHandler") && this.options.globalErrorHandler instanceof Function && this.options.globalErrorHandler(
            c,
            $(this.requestObject, n),
            { requestStartTime: o, requestEndTime: E, requestID: w }
          )(s, i);
        }
      }
    }, this.requestObject = t, this.options = {
      fileKey: "files",
      bodyKey: "body",
      method: "POST",
      primaryKey: "primaryKey",
      normalize: Ae,
      responseKeyCode: "responseStatus",
      headers: { "content-type": "application/json" },
      ...r
    };
  }
}
function tt(e, t, r) {
  return (n) => {
    n({
      type: y.CDEEBEE_ENTITY_UNSAFE_UPDATE_STORE,
      payload: { entityList: e, entityID: t, value: r }
    });
  };
}
function rt(e, t, r) {
  return (n) => {
    n({
      type: y.CDEEBEE_ENTITY_CHANGE_FIELD,
      payload: { entityList: e, entityID: t, valueList: r }
    });
  };
}
function nt(e, t, r) {
  return (n) => {
    n({
      type: y.CDEEBEE_SET_ENTITY,
      payload: { entityList: e, entityID: t, entity: r }
    });
  };
}
function ot(e, t) {
  return (r) => {
    r({
      type: y.CDEEBEE_RESET_ENTITY,
      payload: { entityList: e, entityID: t }
    });
  };
}
function it(e) {
  return (t) => t({ type: y.CDEEBEEE_DROP_PATH, payload: { path: e } });
}
function st(e) {
  return (t) => t({ type: y.CDEEBEEE_DROP_REQUEST_BY_API_URL, payload: { api: e } });
}
function at(e) {
  return (t) => t({ type: y.CDEEBEEE_DROP_ERROR_BY_API_URL, payload: { api: e } });
}
const Et = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  commitEntity: nt,
  dropCdeebeePath: it,
  dropErrorsByApiUrl: at,
  dropRequestByApiUrl: st,
  resetEntity: ot,
  setKeyValue: rt,
  unsafe_updateStore: tt
}, Symbol.toStringTag, { value: "Module" }));
export {
  ft as CdeebeeRequest,
  ct as cdeebee,
  Et as cdeebeeActions,
  U as cdeebeeEntityState,
  ut as cdeebeeHelpers,
  pe as cdeebeeMergeStrategy,
  y as cdeebeeTypes,
  lt as requestManager
};
