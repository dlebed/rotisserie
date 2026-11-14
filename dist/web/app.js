// node_modules/preact/dist/preact.mjs
var n;
var t;
var r;
var u;
var i;
var f;
var o;
var e;
var l;
var c;
var a;
var s;
var h = /* @__PURE__ */ Symbol.for("pv");
var p = {};
var y = [];
var v = /^m(i|n|o|s|text|space)$/;
var w = Array.isArray;
var d = y.slice;
var _ = Object.assign;
function g(n2) {
  n2 && n2.parentNode && n2.remove();
}
function m(r3, u3, i3, f4, o4) {
  var e3 = { type: r3, props: u3, key: i3, ref: f4, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: h, __v: o4 || ++t, __i: -1, __u: 0 };
  return !o4 && n.vnode && n.vnode(e3), e3;
}
function $(n2) {
  return n2.children;
}
function x(n2, t3) {
  this.props = n2, this.context = t3, this.__g = 0;
}
function S(n2, t3) {
  if (null == t3) return n2.__ && S(n2.__, n2.__i + 1);
  for (var r3; t3 < n2.__k.length; t3++) if ((r3 = n2.__k[t3]) && r3.__e) return r3.__e;
  return "function" != typeof n2.type || n2.props.__P ? null : S(n2);
}
function C(t3) {
  var r3, u3 = t3.__v, i3 = u3.__e, f4 = [], o4 = [], e3 = t3.__P;
  e3 && ((r3 = _({ constructor: h }, u3)).__v = u3.__v + 1, n.vnode && n.vnode(r3), z(e3, r3, u3, t3.__n, e3.namespaceURI, 32 & u3.__u ? [i3] : null, f4, i3 || S(u3), 32 & u3.__u, o4), r3.__v = u3.__v, r3.__.__k[r3.__i] = r3, E(f4, r3, o4), u3.__ = u3.__e = null, r3.__e != i3 && j(r3));
}
function j(n2) {
  if ((n2 = n2.__) && n2.__c && !n2.props.__P) return n2.__e = null, n2.__k.some(function(t3) {
    return t3 && (n2.__e = t3.__e);
  }), j(n2);
}
function L(t3) {
  (8 & t3.__g || (t3.__g |= 8, u.push(t3), f++)) && i == n.debounceRendering || ((i = n.debounceRendering) || queueMicrotask)(H);
}
function H() {
  try {
    for (var n2, t3 = 1; u.length; ) u.length > t3 && u.sort(o), n2 = u.shift(), t3 = u.length, 8 & n2.__g && C(n2);
  } finally {
    (f = u.length) && (i || queueMicrotask)(H);
  }
}
function I(n2, t3, r3, u3, i3, f4, o4, e3, l3, c3, a4) {
  var s3, h3, v3, w3, d3, _3, g3 = u3.__k || y, k2 = t3.length;
  for (l3 = q(r3, t3, g3, l3, k2), s3 = 0; s3 < k2; s3++) null != (v3 = r3.__k[s3]) && (h3 = ~v3.__i && g3[v3.__i] || p, v3.__i = s3, _3 = z(n2, v3, h3, i3, f4, o4, e3, l3, c3, a4), w3 = v3.__e, (h3.ref != v3.ref || 8 & h3.__u) && (h3.ref && G(h3.ref, null, v3, h3), v3.ref && a4.push(v3.ref, v3.__c || w3, v3)), d3 = d3 || w3, 4 & v3.__u ? (l3 = A(v3, l3, n2, !h3.__v), h3.__e && (h3.__e = null)) : "function" == typeof v3.type && void 0 !== _3 ? l3 = _3 : w3 && (l3 = w3.nextSibling), v3.__u &= -21);
  return r3.__e = d3, l3;
}
function q(n2, t3, r3, u3, i3) {
  var f4, o4, e3, l3, c3, a4, s3, p3, y3, v3 = r3.length, d3 = v3, _3 = 0, g3 = 0, k2 = n2.__k = Array(i3);
  for (f4 = 0; f4 < i3; f4++) null != (o4 = t3[f4]) && "boolean" != typeof o4 && "function" != typeof o4 ? ("object" != typeof o4 || o4.constructor === String ? o4 = k2[f4] = m(null, o4) : w(o4) ? o4 = k2[f4] = m($, { children: o4 }) : o4.constructor === h && o4.__b ? o4 = k2[f4] = m(o4.type, o4.props, o4.key, o4.ref, o4.__v) : k2[f4] = o4, l3 = f4 + _3, o4.__ = n2, o4.__b = n2.__b + 1, e3 = null, ~(c3 = o4.__i = P(o4, r3, l3, d3)) && (d3--, (e3 = r3[c3]) && (e3.__u |= 2)), e3 && e3.__v ? (o4.__u |= 16, c3 == l3 - 1 ? _3-- : c3 == l3 + 1 ? _3++ : c3 != l3 && (c3 > l3 ? _3-- : _3++, g3 = 1)) : (~c3 || (i3 > v3 ? _3-- : i3 < v3 && _3++), "function" != typeof o4.type && (o4.__u |= 4))) : k2[f4] = null;
  if (g3) {
    for (a4 = [], s3 = [], f4 = 0; f4 < i3; f4++) if ((o4 = k2[f4]) && 16 & o4.__u) {
      for (_3 = 0, p3 = a4.length; _3 < p3; ) a4[y3 = _3 + p3 >> 1] < o4.__i ? _3 = y3 + 1 : p3 = y3;
      a4[_3] = o4.__i, s3[f4] = _3 + 1;
    }
    for (_3 = a4.length; f4--; ) s3[f4] && (s3[f4] == _3 ? _3-- : k2[f4].__u |= 4);
  }
  if (d3) for (f4 = 0; f4 < v3; f4++) !(e3 = r3[f4]) || 2 & e3.__u || (e3.__e == u3 && (u3 = S(e3)), J(e3, e3));
  return u3;
}
function A(n2, t3, r3, u3) {
  var i3, f4, o4, e3;
  if ("function" == typeof n2.type) {
    if (n2.props.__P) return t3;
    if (i3 = n2.__k) for (f4 = 0; f4 < i3.length; f4++) i3[f4] && (i3[f4].__ = n2, t3 = A(i3[f4], t3, r3, false));
    return t3;
  }
  for (t3 && !t3.parentNode && (t3 = S(n2)) && !t3.parentNode && (t3 = null), o4 = n2.__e, e3 = t3; e3 && 8 == e3.nodeType; ) e3 = e3.nextSibling;
  for (o4 != e3 && (!u3 && r3.moveBefore && o4.parentNode ? r3.moveBefore(o4, t3) : r3.insertBefore(o4, t3 || null)), t3 = o4; (t3 = t3 && t3.nextSibling) && 8 == t3.nodeType && !t3.data.startsWith("$s"); ) ;
  return t3;
}
function P(n2, t3, r3, u3) {
  var i3, f4 = n2.key, o4 = n2.type, e3 = t3[r3], l3 = e3 && !(2 & e3.__u);
  if (null === e3 && null == f4 || l3 && f4 == e3.key && o4 == e3.type) return r3;
  if (u3 > (l3 ? 1 : 0)) {
    for (i3 = r3 - 1; i3 >= 0; i3--) if ((e3 = t3[i3]) && !(2 & e3.__u) && f4 == e3.key && o4 == e3.type) return i3;
    for (i3 = r3 + 1; i3 < t3.length; i3++) if ((e3 = t3[i3]) && !(2 & e3.__u) && f4 == e3.key && o4 == e3.type) return i3;
  }
  return -1;
}
function T(n2, t3, r3) {
  null == r3 && (r3 = ""), "-" == t3[0] ? n2.setProperty(t3, r3) : n2[t3] = r3;
}
function N(n2, t3, r3, u3, i3) {
  var f4, o4;
  if ("style" == t3) if ("string" == typeof r3) n2.style.cssText = r3;
  else {
    if ("string" == typeof u3 && (n2.style.cssText = u3 = ""), u3) for (t3 in u3) r3 && t3 in r3 || T(n2.style, t3);
    if (r3) for (t3 in r3) u3 && r3[t3] == u3[t3] || T(n2.style, t3, r3[t3]);
  }
  else if ("o" == t3[0] && "n" == t3[1]) "function" != typeof r3 && (r3 = null), "function" != typeof u3 && (u3 = null), (n2.__e || (n2.__e = {}))[t3] = r3, r3 && u3 || (o4 = a[t3] || (a[t3] = V(t3)), (n2.__a || (n2.__a = {}))[t3] = c, f4 = t3 != (t3 = t3.replace(l, "$1")), (t3 = t3.slice(2))[0] < "a" && (t3 = t3.toLowerCase()), r3 ? n2.addEventListener(t3, o4, f4) : n2.removeEventListener(t3, o4, f4));
  else {
    if ("http://www.w3.org/2000/svg" == i3) t3 = t3.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
    else if ("width" != t3 && "height" != t3 && "href" != t3 && "list" != t3 && "form" != t3 && "tabIndex" != t3 && "download" != t3 && "rowSpan" != t3 && "colSpan" != t3 && "role" != t3 && "popover" != t3 && t3 in n2) try {
      return void (n2[t3] = null == r3 ? "" : r3);
    } catch (n3) {
    }
    if ("function" == typeof r3) return;
    null == r3 || false === r3 && "-" != t3[4] ? n2.removeAttribute(t3) : n2.setAttribute(t3, "popover" == t3 && 1 == r3 ? "" : r3);
  }
}
function V(t3) {
  return function(r3) {
    var u3 = this.__e;
    if (u3) {
      if (u3 = u3[t3], null == r3[e]) r3[e] = c++;
      else if (r3[e] < this.__a[t3]) return;
      return u3(n.event ? n.event(r3) : r3);
    }
  };
}
function z(t3, r3, u3, i3, f4, o4, e3, l3, c3, a4) {
  var s3, p3, v3, d3, k2, b2, m3, M, C3, j2, L2, H2, q2, A3, O, P3, T3, N2, V2 = r3.type;
  if (r3.constructor !== h) return null;
  128 & u3.__u && (c3 = 32 & u3.__u, s3 = u3.__c.__z) && (r3.__u |= c3, p3 = o4 = [], 8 == s3.nodeType ? l3 = B(s3, o4) : o4.push(s3), l3 = o4[0] || l3), (s3 = n.__b) && s3(r3);
  n: if ("function" == typeof V2) {
    v3 = e3.length;
    try {
      if (M = r3.props, C3 = (s3 = V2.prototype) && s3.render, j2 = (s3 = V2.contextType) && i3[s3.__c], L2 = s3 ? j2 ? j2.props.value : s3.__ : i3, (d3 = u3.__c) ? (r3.__c = d3, 2 & d3.__g && (d3.__g |= 1)) : (C3 ? r3.__c = d3 = new V2(M, L2) : (r3.__c = d3 = new x(M, L2), d3.constructor = V2, d3.render = K), j2 && j2.sub(d3), d3.state || (d3.state = {}), d3.__n = i3, d3.__g |= 8, d3.__h = [], d3.__k = []), C3 && (d3.__s || (d3.__s = d3.state), V2.getDerivedStateFromProps && (d3.__s == d3.state && (d3.__s = _({}, d3.__s)), _(d3.__s, V2.getDerivedStateFromProps(M, d3.__s)))), k2 = d3.props, b2 = d3.state, d3.__v = r3, u3.__c) {
        if (M !== k2 && C3 && !V2.getDerivedStateFromProps && d3.componentWillReceiveProps && d3.componentWillReceiveProps(M, L2), r3.__v == u3.__v && !(8 & d3.__g) || !(4 & d3.__g) && d3.shouldComponentUpdate && false === d3.shouldComponentUpdate(M, d3.__s, L2)) {
          r3.__v != u3.__v && (d3.props = M, d3.state = d3.__s, d3.__g &= -9), r3.__e = u3.__e, r3.__k = u3.__k, r3.__k.some(function(n2) {
            n2 && (n2.__ = r3);
          }), y.push.apply(d3.__h, d3.__k), d3.__k = [], d3.__h.length && e3.push(d3), l3 = S(u3);
          break n;
        }
        d3.componentWillUpdate && d3.componentWillUpdate(M, d3.__s, L2), C3 && d3.componentDidUpdate && d3.__h.push(function() {
          d3.componentDidUpdate(k2, b2, m3);
        });
      } else C3 && !V2.getDerivedStateFromProps && d3.componentWillMount && d3.componentWillMount(), C3 && d3.componentDidMount && d3.__h.push(d3.componentDidMount);
      d3.context = L2, d3.props = M, d3.__P = t3, d3.__g &= -5, H2 = n.__r, q2 = C3 ? 25 : 0;
      do {
        d3.__g &= -9, H2 && H2(r3), s3 = d3.render(d3.props, d3.state = d3.__s, d3.context);
      } while (8 & d3.__g && ++q2 < 25);
      C3 && (y.push.apply(d3.__h, d3.__k), d3.__k = []), d3.state = d3.__s, d3.getChildContext && (i3 = _({}, i3, d3.getChildContext())), C3 && u3.__c && d3.getSnapshotBeforeUpdate && (m3 = d3.getSnapshotBeforeUpdate(k2, b2)), A3 = s3 && s3.type === $ && null == s3.key ? s3.props.children : s3, M.__P && (s3 = l3, f4 = (t3 = M.__P).namespaceURI, c3 = o4 = null, u3.props && u3.props.__P != t3 && (u3.__k.some(function(n2) {
        n2 && J(n2, n2);
      }), u3.__k = null), l3 = u3.__k ? S(u3, 0) : null), l3 = I(t3, w(A3) ? A3 : [A3], r3, u3, i3, f4, o4, e3, l3, c3, a4), M.__P && (r3.__e = null, l3 = s3), r3.__u &= -161, p3 && p3.some(g), d3.__h.length && e3.push(d3), 1 & d3.__g && (d3.__g &= -4);
    } catch (t4) {
      if (e3.length = v3, r3.__v = null, c3 || o4) if (t4 && t4.then) {
        if (r3.__u |= 128 | c3, o4) {
          for (~(T3 = o4.indexOf(l3 || void 0)) || (T3 = o4.length); (N2 = o4[T3 - 1]) && 8 == N2.nodeType; ) T3--;
          for (; T3 < o4.length; T3++) if (N2 = o4[T3]) if (o4[T3] = null, O) {
            if (N2 == P3) break;
          } else {
            if (8 != N2.nodeType) break;
            N2.data.startsWith("$s") && (P3 = B(O = N2));
          }
        }
        if (!O) {
          for (; l3 && 8 == l3.nodeType && l3.nextSibling; ) l3 = l3.nextSibling;
          O = l3;
        }
        (s3 = B(O = r3.__c.__z || (r3.__c.__z = O))) ? (r3.__e = O, l3 = s3) : r3.__e = l3, l3 = l3 && l3.nextSibling;
      } else o4 && o4.some(g);
      else r3.__e = u3.__e;
      r3.__k || (r3.__k = u3.__k || []), t4 && t4.then || D(r3), n.__e(t4, r3, u3);
    }
  } else l3 = r3.__e = F(u3.__e, r3, u3, i3, f4, o4, e3, c3, a4, t3);
  return (s3 = n.diffed) && s3(r3), l3;
}
function B(n2, t3) {
  if (n2 && 8 == n2.nodeType && n2.data.startsWith("$s")) for (var r3 = 1; n2 = n2.nextSibling; ) {
    if (8 == n2.nodeType) {
      if (n2.data.startsWith("$s")) r3++;
      else if (n2.data.startsWith("/$s") && !--r3) return n2;
    }
    t3 && t3.push(n2);
  }
}
function D(n2) {
  n2 && (n2.__c && (n2.__c.__g |= 4), n2.__k && n2.__k.some(D));
}
function E(t3, r3, u3) {
  for (var i3 = 0; i3 < u3.length; ) G(u3[i3++], u3[i3++], u3[i3++]);
  n.__c && n.__c(r3, t3), t3.some(function(r4) {
    try {
      t3 = r4.__h, r4.__h = [], t3.some(function(n2) {
        n2.call(r4);
      });
    } catch (t4) {
      n.__e(t4, r4.__v);
    }
  });
}
function F(t3, r3, u3, i3, f4, o4, e3, l3, c3, a4) {
  var s3, h3, y3, _3, k2, b2, m3, M, $2 = u3.props || p, x2 = r3.props, C3 = r3.type;
  if ("svg" == C3 ? f4 = "http://www.w3.org/2000/svg" : "math" == C3 ? f4 = "http://www.w3.org/1998/Math/MathML" : f4 || (f4 = "http://www.w3.org/1999/xhtml"), o4) {
    for (s3 = 0; s3 < o4.length; s3++) if ((k2 = o4[s3]) && (C3 ? k2.localName == C3 : 3 == k2.nodeType)) {
      t3 = k2, o4[s3] = null;
      break;
    }
  }
  if (!t3) {
    if (M = a4.ownerDocument || document, !C3) return M.createTextNode(x2);
    t3 = M.createElementNS(f4, C3, x2.is ? x2 : a4), l3 && (n.__m && n.__m(r3, o4), l3 = false), o4 = null;
  }
  if (C3) {
    if (a4 = "template" == C3 && t3.content || t3, o4 = "textarea" == C3 && null != x2.defaultValue ? null : o4 && d.call(a4.childNodes), !l3 && o4) for ($2 = {}, s3 = 0; s3 < t3.attributes.length; s3++) $2[(k2 = t3.attributes[s3]).name] = k2.value;
    for (s3 in $2) k2 = $2[s3], "dangerouslySetInnerHTML" == s3 ? y3 = k2 : "children" == s3 || s3 in x2 || "value" == s3 && "defaultValue" in x2 || "checked" == s3 && "defaultChecked" in x2 || N(t3, s3, null, k2, f4);
    for (s3 in x2) k2 = x2[s3], "children" == s3 ? _3 = k2 : "dangerouslySetInnerHTML" == s3 ? h3 = k2 : "value" == s3 ? b2 = k2 : "checked" == s3 ? m3 = k2 : l3 && "function" != typeof k2 || $2[s3] === k2 || N(t3, s3, k2, $2[s3], f4);
    h3 ? (l3 || y3 && (h3.__html == y3.__html || h3.__html == t3.innerHTML) || (t3.innerHTML = h3.__html), r3.__k = []) : (y3 && (t3.textContent = ""), ("foreignObject" == C3 || "http://www.w3.org/1998/Math/MathML" == f4 && v.test(C3)) && (f4 = "http://www.w3.org/1999/xhtml"), I(a4, w(_3) ? _3 : [_3], r3, u3, i3, f4, o4, e3, o4 ? o4[0] : u3.__k && S(u3, 0), l3, c3), o4 && o4.some(g)), l3 && "textarea" != C3 || (s3 = "value", "progress" == C3 && null == b2 ? t3.removeAttribute(s3) : null == b2 || b2 === t3[s3] && ("progress" != C3 || b2) || N(t3, s3, b2, $2[s3], f4), s3 = "checked", null != m3 && m3 != t3[s3] && N(t3, s3, m3, $2[s3], f4));
  } else $2 === x2 || l3 && t3.data == x2 || (t3.data = x2);
  return t3;
}
function G(t3, r3, u3, i3) {
  try {
    "function" == typeof t3 ? r3 ? r3.__x = t3(r3) || 1 : i3 && (i3 = i3.__c || i3.__e) && (r3 = i3.__x) && (i3.__x = null, "function" == typeof r3 ? r3() : t3(null)) : t3.current = r3;
  } catch (t4) {
    n.__e(t4, u3);
  }
}
function J(t3, r3, u3) {
  var i3, f4, o4, e3;
  if (n.unmount && n.unmount(t3), !(i3 = t3.ref) || i3.current && i3.current != t3.__e || G(i3, null, r3, t3), i3 = t3.__c) {
    if (i3.componentWillUnmount) try {
      i3.componentWillUnmount();
    } catch (t4) {
      n.__e(t4, r3);
    }
    i3.__P = i3.__n = null;
  }
  if (i3 = t3.__k) for (e3 = 0; e3 < i3.length; e3++) i3[e3] && J(i3[e3], r3, "function" != typeof t3.type || u3 && !t3.props.__P);
  !u3 && (i3 = t3.__c) && (i3 = i3.__z) && (f4 = B(i3, o4 = [])) && (i3 == t3.__e && o4.some(g), g(f4), g(i3)), u3 || g(t3.__e), t3.__e = t3.__c = t3.__ = null;
}
function K(n2, t3, r3) {
  return this.constructor(n2, r3);
}
function Q(t3, r3) {
  var u3, i3, f4, o4;
  n.__ && n.__(t3, r3), 9 == r3.nodeType && (r3 = r3.documentElement), i3 = (u3 = t3 && 32 & t3.__u) ? null : r3.__k, r3.__k = m($, { children: [t3] }), f4 = [], o4 = [], z(r3, r3.__k, i3 || p, p, r3.namespaceURI, i3 ? null : r3.firstChild ? d.call(r3.childNodes) : null, f4, i3 ? i3.__e : r3.firstChild, u3, o4), E(f4, r3.__k, o4), r3.__k.props.children = null;
}
n = { __e: function(n2, t3, r3, u3) {
  for (var i3, o4, e3; t3 = t3.__; ) if ((i3 = t3.__c) && !(1 & i3.__g)) {
    i3.__g |= 4;
    try {
      if ((e3 = (o4 = i3.constructor) && o4.getDerivedStateFromError) && i3.setState(o4.getDerivedStateFromError(n2)), i3.componentDidCatch && (i3.componentDidCatch(n2, u3 || {}), e3 = 1), e3 && 8 & i3.__g) return void (i3.__g |= 2);
    } catch (t4) {
      n2 = t4;
    }
  }
  throw f = 0, n2;
} }, t = 0, r = function(n2) {
  return null != n2 && n2.constructor === h;
}, x.prototype.setState = function(n2, t3) {
  var r3 = this.__s;
  r3 && r3 != this.state || (r3 = this.__s = _({}, this.state)), "function" == typeof n2 && (n2 = n2(_({}, r3), this.props)), n2 && (_(r3, n2), this.__v && (t3 && this.__k.push(t3), L(this)));
}, x.prototype.forceUpdate = function(n2) {
  this.__v && (this.__g |= 4, n2 && this.__h.push(n2), L(this));
}, x.prototype.render = $, u = [], f = 0, o = function(n2, t3) {
  return n2.__v.__b - t3.__v.__b;
}, e = /* @__PURE__ */ Symbol(), l = /(PointerCapture)$|Capture$/i, c = 0, a = {}, s = 0;

// node_modules/preact/hooks/dist/hooks.mjs
var t2;
var r2;
var u2;
var i2;
var o2 = Object.is;
var f2 = 0;
var c2 = [];
var e2 = [];
var a2 = n;
var v2 = a2.__b;
var l2 = a2.__r;
var m2 = a2.diffed;
var h2 = a2.__c;
var s2 = a2.unmount;
var p2 = a2.__;
function y2(n2, t3) {
  a2.__h && a2.__h(r2, n2, f2 || t3), f2 = 0;
  var u3 = r2.__H || (r2.__H = { __: [], __h: [] });
  return n2 >= u3.__.length && u3.__.push({}), u3.__[n2];
}
function d2(n2) {
  return f2 = 1, _2(G2, n2);
}
function _2(n2, u3, i3) {
  var f4 = y2(t2++, 2);
  if (f4.t = n2, !f4.__c && (f4.__ = [i3 ? i3(u3) : G2(void 0, u3), function(n3) {
    var t3 = (f4.__N || f4.__)[0], r3 = f4.t(t3, n3);
    o2(t3, r3) || (f4.__N = [r3, f4.__[1]], f4.__c.setState({}));
  }], f4.__c = r2, !r2.__f)) {
    r2.__f = true;
    var c3 = r2.shouldComponentUpdate;
    r2.shouldComponentUpdate = function(n3, t3, r3) {
      var u4 = this.__H;
      if (!u4) return true;
      var i4 = false, f5 = this.props != n3;
      if (u4.__.some(function(n4) {
        n4.__N && (i4 = true, o2(n4.__[0], n4.__N[0]) || (f5 = true));
      }), c3) {
        var e3 = c3.call(this, n3, t3, r3);
        return i4 ? e3 || f5 : e3;
      }
      return !i4 || f5;
    };
  }
  return f4.__;
}
function A2(n2, u3) {
  var i3 = y2(t2++, 3);
  !a2.__s && E2(i3.__H, u3) && (i3.__P = true, i3.__ = n2, i3.u = u3, r2.__H.__h.push(i3));
}
function F2(n2, u3) {
  var i3 = y2(t2++, 4);
  !a2.__s && E2(i3.__H, u3) && (i3.__P = false, i3.__ = n2, i3.u = u3, r2.__h.push(i3));
}
function T2(n2) {
  return f2 = 5, w2(function() {
    return { current: n2 };
  }, []);
}
function w2(n2, r3) {
  var u3 = y2(t2++, 7);
  return E2(u3.__H, r3) && (u3.__ = n2(), u3.__H = r3), u3.__;
}
function b(n2, t3) {
  return f2 = 8, w2(function() {
    return n2;
  }, t3);
}
function P2() {
  var n2 = y2(t2++, 11);
  if (!n2.__) {
    for (var u3 = r2.__v; !u3.__m && u3.__; ) u3 = u3.__;
    var i3 = u3.__m || (u3.__m = [0, 0]);
    n2.__ = "P" + i3[0] + "-" + i3[1]++;
  }
  return n2.__;
}
function g2() {
  var n2;
  do {
    for (; n2 = e2.shift(); ) try {
      C2(n2);
    } catch (t4) {
      a2.__e(t4, { __: (n2 = n2.__P) && n2.__v });
    }
    for (; n2 = c2.shift(); ) {
      var t3 = n2.__H;
      if (n2.__P && t3) try {
        t3.__h.some(C2), t3.__h.some(D2), t3.__h = [];
      } catch (r3) {
        t3.__h = [], a2.__e(r3, n2.__v);
      }
    }
  } while (e2.length);
}
a2.__b = function(n2) {
  r2 = null, v2 && v2(n2);
}, a2.__ = function(n2, t3) {
  n2 && t3.__k && t3.__k.__m && (n2.__m = t3.__k.__m), p2 && p2(n2, t3);
}, a2.__r = function(n2) {
  l2 && l2(n2), t2 = 0;
  var i3 = (r2 = n2.__c).__H;
  i3 && (u2 == r2 ? r2.__h = [] : (i3.__h.some(C2), i3.__h.some(D2), t2 = 0), i3.__h = [], i3.__.some(function(n3) {
    n3.__N && (n3.__ = n3.__N), n3.u = n3.__N = void 0;
  })), u2 = r2;
}, a2.diffed = function(n2) {
  m2 && m2(n2);
  var t3 = n2.__c;
  t3 && t3.__H && (t3.__H.__h.length && B2(c2.push(t3)), t3.__H.__.some(function(n3) {
    n3.u && (n3.__H = n3.u);
  })), u2 = r2 = null;
}, a2.__c = function(n2, t3) {
  t3.some(function(n3) {
    try {
      n3.__h.some(C2), n3.__h = n3.__h.filter(function(n4) {
        return !n4.__ || D2(n4);
      });
    } catch (t4) {
      n3.__h = [function() {
        throw t4;
      }];
    }
  }), h2 && h2(n2, t3);
}, a2.unmount = function(n2) {
  s2 && s2(n2);
  var t3, r3, u3 = n2.__c;
  u3 && u3.__H && (u3.__H.__.some(function(u4) {
    try {
      if (u4.__P && u4.__c) {
        if (void 0 === r3) {
          for (r3 = n2.__; r3 && (!r3.__c || !r3.__c.__P); ) r3 = r3.__;
          r3 = r3 && r3.__c;
        }
        u4.__P = r3, B2(e2.push(u4));
      } else C2(u4);
    } catch (n3) {
      t3 = n3;
    }
  }), u3.__H = void 0, t3 && a2.__e(t3, u3.__v));
};
var k = "function" == typeof requestAnimationFrame;
function z2(n2) {
  var t3, r3 = function() {
    clearTimeout(u3), k && cancelAnimationFrame(t3), setTimeout(n2);
  }, u3 = setTimeout(r3, 35);
  k && (t3 = requestAnimationFrame(r3));
}
function B2(n2) {
  1 != n2 && i2 == a2.requestAnimationFrame || ((i2 = a2.requestAnimationFrame) || z2)(g2);
}
function C2(n2) {
  var t3 = r2, u3 = n2.__c;
  "function" == typeof u3 && (n2.__c = void 0, u3()), r2 = t3;
}
function D2(n2) {
  var t3 = r2;
  n2.__c = n2.__(), r2 = t3;
}
function E2(n2, t3) {
  return !n2 || n2.length != t3.length || t3.some(function(t4, r3) {
    return !o2(t4, n2[r3]);
  });
}
function G2(n2, t3) {
  return "function" == typeof t3 ? t3(n2) : t3;
}

// web/src/api.ts
var seg = encodeURIComponent;
var ApiError = class extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "ApiError";
  }
  status;
  code;
};
function createApi(deps) {
  async function call(method, url, body, cid) {
    const headers = {};
    if (body !== void 0) headers["content-type"] = "application/json";
    if (cid) headers["x-rotisserie-cid"] = cid;
    const init = { method, credentials: "same-origin", headers };
    if (body !== void 0) init.body = JSON.stringify(body);
    const res = await deps.fetch(url, init);
    let parsed = null;
    try {
      parsed = await res.json();
    } catch {
    }
    return { status: res.status, body: parsed };
  }
  async function read(url) {
    const r3 = await call("GET", url);
    if (r3.status < 200 || r3.status >= 300) {
      const b2 = r3.body && typeof r3.body === "object" ? r3.body : {};
      throw new ApiError(
        r3.status,
        typeof b2.message === "string" ? b2.message : `GET ${url} failed with ${r3.status}`,
        typeof b2.error === "string" ? b2.error : void 0
      );
    }
    return r3.body;
  }
  return {
    listSessions: () => read("/api/sessions"),
    getSession: (pk, id) => read(`/api/sessions/${seg(pk)}/${seg(id)}`),
    health: () => read("/api/health"),
    subscribe(cb) {
      const es = new deps.EventSource("/api/events");
      es.onmessage = (e3) => {
        try {
          cb(JSON.parse(e3.data));
        } catch {
        }
      };
      return () => es.close();
    },
    /** Resolves with the status and body of any HTTP response; rejects only on a network error. */
    send(pk, id, a4) {
      const base = `/api/sessions/${seg(pk)}/${seg(id)}`;
      const q2 = seg("qid" in a4 ? a4.qid : "");
      switch (a4.kind) {
        case "mark":
          return call("PUT", `${base}/responses/${q2}`, a4.response, a4.cid);
        case "clear":
          return call("DELETE", `${base}/responses/${q2}`, void 0, a4.cid);
        case "draft":
          return call("PUT", `${base}/drafts/${q2}`, a4.draft, a4.cid);
        case "respond":
          return call("POST", `${base}/respond`, void 0, a4.cid);
        case "confirm":
          return call("POST", `${base}/confirm`, void 0, a4.cid);
        case "reopen":
          return call("POST", `${base}/reopen`, { note: a4.note }, a4.cid);
      }
    }
  };
}
var shared;
var api = {
  listSessions: () => (shared ??= defaults()).listSessions(),
  getSession: (pk, id) => (shared ??= defaults()).getSession(pk, id),
  health: () => (shared ??= defaults()).health(),
  subscribe: (cb) => (shared ??= defaults()).subscribe(cb),
  send: (pk, id, a4) => (shared ??= defaults()).send(pk, id, a4)
};
function defaults() {
  return createApi({
    fetch: (input, init) => window.fetch(input, init),
    EventSource: window.EventSource
  });
}

// web/src/nav.ts
function parseRoute(pathname) {
  const m3 = /^\/s\/([^/]+)\/([^/]+)\/?$/.exec(pathname);
  if (!m3) return { name: "home" };
  try {
    return { name: "session", pk: decodeURIComponent(m3[1] ?? ""), id: decodeURIComponent(m3[2] ?? "") };
  } catch {
    return { name: "home" };
  }
}
var sessionPath = (pk, id) => `/s/${encodeURIComponent(pk)}/${encodeURIComponent(id)}`;
function stripToken() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("t")) return;
  url.searchParams.delete("t");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

// web/src/keyboard.ts
function nextOpen(order, questions, from) {
  for (let i3 = order.indexOf(from) + 1; i3 < order.length; i3++) {
    const qid = order[i3];
    if (qid !== void 0 && questions[qid]?.status === "open") return qid;
  }
  return null;
}
var macOverride;
function isMac() {
  if (macOverride !== void 0) return macOverride;
  if (typeof navigator === "undefined") return false;
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  return /mac|iphone|ipad/i.test(platform);
}
function hintFor(k2) {
  const mac = isMac();
  switch (k2) {
    case "done":
      return mac ? { text: "\u2318\u21B5", shortcut: "Meta+Enter" } : { text: "Ctrl+Enter", shortcut: "Control+Enter" };
    case "respond":
      return mac ? { text: "\u2318\u21E7\u21B5", shortcut: "Meta+Shift+Enter" } : { text: "Ctrl+Shift+Enter", shortcut: "Control+Shift+Enter" };
    case "skip":
      return { text: "s", shortcut: "s" };
    case "invalid":
      return { text: "i", shortcut: "i" };
    case "later":
      return { text: "l", shortcut: "l" };
    case "accept":
      return { text: "a", shortcut: "a" };
  }
}
function shortcutList() {
  const mod = isMac() ? "\u2318" : "Ctrl+";
  const enter = isMac() ? "\u21B5" : "Enter";
  const shift = isMac() ? "\u21E7" : "Shift+";
  return [
    { keys: `${mod}${enter}`, does: "Done, then the next open question" },
    { keys: `${mod}${shift}${enter}`, does: "Respond to the agent" },
    { keys: "Alt+\u2193 / Alt+\u2191", does: "Next / previous question, also while typing" },
    { keys: "j / k", does: "Next / previous question" },
    { keys: "n", does: "Next new question" },
    { keys: "1\u20139", does: "Pick that option; again to deselect it" },
    { keys: "a", does: "Accept the recommendation" },
    { keys: "s / i / l", does: "Skip, Invalid, Later" },
    { keys: "e or Enter", does: "Unfold the focused question" },
    { keys: "Esc", does: "Leave the text field; again to fold an answered question unchanged" },
    { keys: "?", does: "Show or hide this list" }
  ];
}
function isTextField(t3) {
  if (!(t3 instanceof HTMLElement)) return false;
  if (t3.isContentEditable || t3 instanceof HTMLTextAreaElement || t3 instanceof HTMLSelectElement) return true;
  return t3 instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "reset", "range", "image"].includes(t3.type);
}
function keyAction(e3, mac) {
  const a4 = parse(e3, mac);
  return a4 && e3.repeat && a4.kind !== "next" && a4.kind !== "prev" ? null : a4;
}
function parse(e3, mac) {
  if (e3.isComposing) return null;
  const mod = mac ? e3.metaKey : e3.ctrlKey;
  const stray = mac ? e3.ctrlKey : e3.metaKey;
  if (e3.key === "Enter" && mod && !stray && !e3.altKey) return { kind: e3.shiftKey ? "respond" : "done" };
  if (e3.altKey && !e3.ctrlKey && !e3.metaKey && !e3.shiftKey) {
    if (e3.key === "ArrowDown") return { kind: "next" };
    if (e3.key === "ArrowUp") return { kind: "prev" };
    return null;
  }
  if (e3.ctrlKey || e3.metaKey || e3.altKey) return null;
  if (e3.key === "Escape") return { kind: "escape" };
  if (isTextField(e3.target)) return null;
  switch (e3.key) {
    case "j":
      return { kind: "next" };
    case "k":
      return { kind: "prev" };
    case "n":
      return { kind: "nextNew" };
    case "a":
      return { kind: "accept" };
    case "s":
      return { kind: "skip" };
    case "i":
      return { kind: "invalid" };
    case "l":
      return { kind: "later" };
    case "e":
      return { kind: "unfold" };
    case "?":
      return { kind: "help" };
    case "Enter":
      return e3.target instanceof HTMLElement && e3.target.hasAttribute("data-qid") ? { kind: "unfold" } : null;
  }
  return /^[1-9]$/.test(e3.key) ? { kind: "option", n: Number(e3.key) } : null;
}
function useSessionKeys(run) {
  const latest = T2(run);
  latest.current = run;
  A2(() => {
    const onKey = (e3) => {
      const action = keyAction(e3, isMac());
      if (action && latest.current(action, e3.target)) e3.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}

// node_modules/preact/jsx-runtime/dist/jsxRuntime.mjs
var f3 = /* @__PURE__ */ Symbol.for("pv");
var o3 = 0;
function a3(t3, e3, n2, u3, a4, i3) {
  e3 || (e3 = {});
  var c3, l3, p3 = e3;
  if ("ref" in p3 && "function" != typeof t3) for (l3 in p3 = {}, e3) "ref" == l3 ? c3 = e3[l3] : p3[l3] = e3[l3];
  var s3 = { type: t3, props: p3, key: n2, ref: c3, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: f3, __v: --o3, __i: -1, __u: 0 };
  return (a4 || i3) && (s3.__source = a4, s3.__self = i3), n.vnode && n.vnode(s3), s3;
}

// web/src/KeyHint.tsx
function KeyHint({ k: k2 }) {
  return /* @__PURE__ */ a3("kbd", { class: "rt-keycap", "aria-hidden": "true", children: hintFor(k2).text });
}
var keyShortcuts = (k2) => hintFor(k2).shortcut;

// web/src/ProgressMeter.tsx
var SEGMENTS = [
  { key: "sent", label: "Sent" },
  { key: "done", label: "Done, not sent" },
  { key: "open", label: "Open" }
];
function ProgressMeter({ progress }) {
  const { sent, done, open, total, totalAtLastBatch } = progress;
  const grew = totalAtLastBatch !== null && total > totalAtLastBatch;
  const counts = { sent, done, open };
  return /* @__PURE__ */ a3("section", { class: "rt-progress", "aria-label": "Progress", children: [
    /* @__PURE__ */ a3("div", { class: "rt-progress-head", children: [
      /* @__PURE__ */ a3("div", { children: [
        /* @__PURE__ */ a3("span", { class: "rt-progress-count", children: `${sent + done} of ${total}` }),
        " ",
        /* @__PURE__ */ a3("span", { class: "rt-text-2", children: "answered" })
      ] }),
      /* @__PURE__ */ a3("div", { class: "rt-progress-note", children: [
        `${open} to go`,
        grew ? ` \xB7 total grew from ${totalAtLastBatch} to ${total}` : ""
      ] })
    ] }),
    total > 0 && /* @__PURE__ */ a3("div", { class: "rt-meter-bar", role: "img", "aria-label": `${sent} sent, ${done} done and not yet sent, ${open} open`, children: SEGMENTS.filter((s3) => counts[s3.key] > 0).map((s3) => /* @__PURE__ */ a3("span", { class: `rt-meter-seg rt-fill-${s3.key}`, style: { flexGrow: counts[s3.key] } }, s3.key)) }),
    /* @__PURE__ */ a3("div", { class: "rt-legend", "data-testid": "progress-legend", children: SEGMENTS.map((s3) => /* @__PURE__ */ a3("span", { class: "rt-legend-item", children: [
      /* @__PURE__ */ a3("span", { class: `rt-swatch rt-fill-${s3.key}`, "aria-hidden": "true" }),
      s3.label,
      " ",
      /* @__PURE__ */ a3("span", { class: "rt-legend-n", children: counts[s3.key] })
    ] }, s3.key)) })
  ] });
}

// web/src/AnswerForm.tsx
function AnswerForm({ q: q2, draft, saved, onChange }) {
  const id = P2();
  const options = q2.options ?? [];
  const recommended = options.filter((o4) => o4.recommended).map((o4) => o4.id);
  const recText = q2.recommendation ?? options.filter((o4) => o4.recommended).map((o4) => o4.label).join(", ");
  const accept = () => {
    if (recommended.length > 0) onChange({ ...draft, optionIds: q2.multi ? recommended : recommended.slice(0, 1) });
    else if (q2.recommendation) onChange({ ...draft, text: q2.recommendation });
  };
  const toggle = (oid, on) => {
    const set = new Set(q2.multi ? draft.optionIds : []);
    if (on) set.add(oid);
    else set.delete(oid);
    onChange({ ...draft, optionIds: options.filter((o4) => set.has(o4.id)).map((o4) => o4.id) });
  };
  return /* @__PURE__ */ a3($, { children: [
    recText && /* @__PURE__ */ a3("div", { class: "rt-rec", children: [
      /* @__PURE__ */ a3("div", { class: "rt-rec-text", children: [
        /* @__PURE__ */ a3("div", { class: "rt-eyebrow", children: "Agent recommends" }),
        /* @__PURE__ */ a3("div", { class: "rt-pre", children: recText })
      ] }),
      /* @__PURE__ */ a3("button", { type: "button", class: "rt-btn", "data-rt-action": "accept", "aria-keyshortcuts": keyShortcuts("accept"), onClick: accept, children: [
        "Accept",
        /* @__PURE__ */ a3(KeyHint, { k: "accept" })
      ] })
    ] }),
    options.length > 0 && /* @__PURE__ */ a3("fieldset", { class: "rt-options", children: [
      /* @__PURE__ */ a3("legend", { class: "rt-eyebrow", children: q2.multi ? "Pick any" : "Pick one" }),
      options.map((o4) => {
        const checked = draft.optionIds.includes(o4.id);
        return /* @__PURE__ */ a3("label", { class: `rt-option${checked ? " is-checked" : ""}`, children: [
          /* @__PURE__ */ a3(
            "input",
            {
              type: q2.multi ? "checkbox" : "radio",
              name: `${id}-opt`,
              checked,
              onChange: (e3) => toggle(o4.id, e3.currentTarget.checked),
              onClick: () => {
                if (!q2.multi && checked) toggle(o4.id, false);
              }
            }
          ),
          /* @__PURE__ */ a3("span", { class: "rt-option-text", children: [
            /* @__PURE__ */ a3("span", { class: "rt-option-head", children: [
              /* @__PURE__ */ a3("span", { class: "rt-option-label", children: o4.label }),
              o4.recommended && /* @__PURE__ */ a3("span", { class: "rt-tag", children: "Recommended" })
            ] }),
            o4.consequence && /* @__PURE__ */ a3("span", { class: "rt-option-consequence", children: o4.consequence })
          ] })
        ] }, o4.id);
      })
    ] }),
    /* @__PURE__ */ a3("div", { class: "rt-field", children: [
      /* @__PURE__ */ a3("label", { class: "rt-field-label", for: `${id}-text`, children: options.length > 0 ? "Write my own answer" : "Your answer" }),
      /* @__PURE__ */ a3(
        "textarea",
        {
          id: `${id}-text`,
          class: "rt-input rt-textarea",
          rows: 3,
          value: draft.text,
          onInput: (e3) => onChange({ ...draft, text: e3.currentTarget.value })
        }
      ),
      /* @__PURE__ */ a3("div", { class: "rt-hint", "aria-live": "polite", children: saved ? "Draft saved" : "" })
    ] }),
    /* @__PURE__ */ a3("div", { class: "rt-field", children: [
      /* @__PURE__ */ a3("label", { class: "rt-field-label", for: `${id}-note`, children: "Add a note (optional)" }),
      /* @__PURE__ */ a3(
        "input",
        {
          id: `${id}-note`,
          class: "rt-input",
          type: "text",
          value: draft.note,
          placeholder: "For example: only for v1",
          onInput: (e3) => onChange({ ...draft, note: e3.currentTarget.value })
        }
      )
    ] })
  ] });
}
var REASONS = ["wrong premise", "already answered", "out of scope", "unclear"];
function InvalidPanel({ onCancel, onSubmit }) {
  const id = P2();
  const [reason, setReason] = d2(null);
  const [why, setWhy] = d2("");
  const first = T2(null);
  const panel = T2(null);
  A2(() => {
    first.current?.focus();
    panel.current?.scrollIntoView?.({ block: "nearest" });
  }, []);
  const submit = () => {
    if (reason) onSubmit(why.trim() ? `${reason}: ${why.trim()}` : reason);
  };
  return /* @__PURE__ */ a3("div", { ref: panel, class: "rt-invalid-panel", role: "group", "aria-labelledby": `${id}-why`, children: [
    /* @__PURE__ */ a3("div", { class: "rt-field-label", id: `${id}-why`, children: "Why is this question invalid?" }),
    /* @__PURE__ */ a3("div", { class: "rt-chips", children: REASONS.map((r3, i3) => /* @__PURE__ */ a3(
      "button",
      {
        ref: i3 === 0 ? first : void 0,
        type: "button",
        class: "rt-chip",
        "aria-pressed": reason === r3,
        onClick: () => setReason(r3),
        children: r3[0].toUpperCase() + r3.slice(1)
      },
      r3
    )) }),
    /* @__PURE__ */ a3("div", { class: "rt-field", children: [
      /* @__PURE__ */ a3("label", { class: "rt-field-label", for: `${id}-note`, children: "Explain (optional)" }),
      /* @__PURE__ */ a3("input", { id: `${id}-note`, class: "rt-input", type: "text", value: why, onInput: (e3) => setWhy(e3.currentTarget.value) })
    ] }),
    /* @__PURE__ */ a3("div", { class: "rt-actions", children: [
      /* @__PURE__ */ a3("button", { type: "button", class: "rt-btn-ghost", onClick: onCancel, children: "Cancel" }),
      /* @__PURE__ */ a3("button", { type: "button", class: "rt-btn-primary", disabled: !reason, onClick: submit, children: "Mark invalid" })
    ] })
  ] });
}

// web/src/StateBadge.tsx
function stateInfo(q2, later = false) {
  const kind = q2.response?.kind;
  const revised = q2.isRevision ? ", revised" : "";
  switch (q2.status) {
    case "open":
      return later ? { icon: "later", label: "Later", tone: "open" } : { icon: "open", label: "Open", tone: "open" };
    case "done":
      if (kind === "skip") return { icon: "skip", label: `Skipped, not sent${revised}`, tone: "done" };
      if (kind === "invalid") return { icon: "alert", label: `Invalid, not sent${revised}`, tone: "done" };
      return { icon: "check", label: `Done, not sent${revised}`, tone: "done" };
    case "sent":
      if (kind === "skip") return { icon: "sent-skip", label: "Skipped", tone: "sent" };
      if (kind === "invalid") return { icon: "alert", label: "Invalid", tone: "invalid" };
      return { icon: "sent", label: "Sent", tone: "sent" };
    case "settled":
      return { icon: "settled", label: "Settled", tone: "sent" };
    case "assumed":
      return { icon: "assumed", label: "Assumed by agent", tone: "assumed" };
    case "retracted":
      return { icon: "retracted", label: "Retracted", tone: "open" };
  }
}
var paths = () => ({
  open: /* @__PURE__ */ a3("circle", { cx: "12", cy: "12", r: "9" }),
  later: /* @__PURE__ */ a3($, { children: [
    /* @__PURE__ */ a3("circle", { cx: "12", cy: "12", r: "9" }),
    /* @__PURE__ */ a3("path", { d: "M12 7.5V12l3 2" })
  ] }),
  check: /* @__PURE__ */ a3("path", { d: "M5 12.5l4.5 4.5L19 7.5" }),
  skip: /* @__PURE__ */ a3("path", { d: "M5 7l5 5-5 5M13 7l5 5-5 5" }),
  alert: /* @__PURE__ */ a3($, { children: [
    /* @__PURE__ */ a3("circle", { cx: "12", cy: "12", r: "9" }),
    /* @__PURE__ */ a3("path", { d: "M12 7.5V13" }),
    /* @__PURE__ */ a3("path", { d: "M12 16.5v.1" })
  ] }),
  sent: /* @__PURE__ */ a3($, { children: [
    /* @__PURE__ */ a3("circle", { cx: "12", cy: "12", r: "9" }),
    /* @__PURE__ */ a3("path", { d: "M8 12.5l3 3 5-6" })
  ] }),
  "sent-skip": /* @__PURE__ */ a3($, { children: [
    /* @__PURE__ */ a3("circle", { cx: "12", cy: "12", r: "9" }),
    /* @__PURE__ */ a3("path", { d: "M8 9l3 3-3 3M12.5 9l3 3-3 3" })
  ] }),
  settled: /* @__PURE__ */ a3($, { children: [
    /* @__PURE__ */ a3("circle", { cx: "12", cy: "12", r: "9", fill: "currentColor" }),
    /* @__PURE__ */ a3("path", { class: "rt-icon-knockout", d: "M8 12.5l3 3 5-6" })
  ] }),
  assumed: /* @__PURE__ */ a3("path", { d: "M12 3l2.2 5.6L20 9.3l-4.4 3.9L17 19l-5-3-5 3 1.4-5.8L4 9.3l5.8-.7z" }),
  retracted: /* @__PURE__ */ a3($, { children: [
    /* @__PURE__ */ a3("circle", { cx: "12", cy: "12", r: "9" }),
    /* @__PURE__ */ a3("path", { d: "M8 12h8" })
  ] })
});
function StateIcon({ info }) {
  return /* @__PURE__ */ a3(
    "svg",
    {
      class: `rt-state-icon rt-tone-${info.tone}`,
      "aria-hidden": "true",
      width: "20",
      height: "20",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2.2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      children: paths()[info.icon]
    }
  );
}
function StateLabel({ info }) {
  return /* @__PURE__ */ a3("span", { class: `rt-state-label rt-tone-${info.tone}`, children: info.label });
}

// web/src/QuestionCard.tsx
var FOLD_MS = 200;
var DRAFT_MS = 500;
var EMPTY = { optionIds: [], text: "", note: "" };
function fromResponse(r3) {
  return r3?.kind === "answer" ? { optionIds: [...r3.optionIds], text: r3.text ?? "", note: r3.note ?? "" } : EMPTY;
}
var sameIds = (a4, b2) => a4.length === b2.length && [...a4].sort().join("\n") === [...b2].sort().join("\n");
function unchanged(q2, d3) {
  const r3 = q2.response;
  if (q2.status === "open" || r3?.kind !== "answer") return false;
  return sameIds(r3.optionIds, d3.optionIds) && (r3.text ?? "").trim() === d3.text.trim() && (r3.note ?? "").trim() === d3.note.trim();
}
function animates() {
  try {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
function useFold(open) {
  const [mounted, setMounted] = d2(open);
  F2(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    if (!animates()) {
      setMounted(false);
      return;
    }
    const t3 = setTimeout(() => setMounted(false), FOLD_MS);
    return () => clearTimeout(t3);
  }, [open]);
  return { shown: open || mounted, closing: !open && mounted };
}
function optionLabels(q2, ids) {
  return ids.map((id) => q2.options?.find((o4) => o4.id === id)?.label ?? id);
}
function oneLine(q2) {
  if (q2.status === "retracted") return `Retracted by agent: ${q2.reason ?? ""}`;
  if ((q2.status === "settled" || q2.status === "assumed") && q2.decision) return q2.decision;
  const r3 = q2.response;
  if (!r3) return "";
  if (r3.kind === "skip") return "You skipped. The agent will decide.";
  if (r3.kind === "invalid") return r3.reason;
  return [...optionLabels(q2, r3.optionIds), r3.text ?? "", r3.note ?? ""].filter((s3) => s3.trim() !== "").join(" \xB7 ");
}
function QuestionCard(p3) {
  const q2 = p3.question;
  const info = stateInfo(q2, p3.later);
  const retracted = q2.status === "retracted";
  const open = p3.expanded && !retracted && !p3.readOnly;
  const record = p3.expanded && !!p3.readOnly;
  const fold = useFold(open || record);
  const quiet = q2.status === "sent" || q2.status === "settled" || q2.status === "assumed";
  const root2 = T2(null);
  const [draft, setDraft] = d2(() => q2.status === "open" ? p3.draft ?? EMPTY : fromResponse(q2.response));
  const [saved, setSaved] = d2(false);
  const [dirty, setDirty] = d2(() => q2.status === "open" && (p3.draft?.text.trim() ?? "") !== "");
  const [invalid, setInvalid] = d2(false);
  const timer = T2(void 0);
  const latest = T2({ draft, onDraft: p3.onDraft });
  latest.current = { draft, onDraft: p3.onDraft };
  const wasOpen = T2(open);
  F2(() => {
    if (open && !wasOpen.current && q2.status !== "open") {
      setDraft(fromResponse(q2.response));
      setSaved(false);
      setDirty(false);
    }
    if (!open) setInvalid(false);
    wasOpen.current = open;
  }, [open]);
  const cancelDraft = () => {
    clearTimeout(timer.current);
    timer.current = void 0;
  };
  A2(() => () => {
    if (timer.current === void 0) return;
    cancelDraft();
    latest.current.onDraft?.(q2.id, latest.current.draft);
  }, []);
  const change = (next) => {
    setDraft(next);
    setSaved(false);
    setDirty(true);
    cancelDraft();
    timer.current = setTimeout(() => {
      timer.current = void 0;
      latest.current.onDraft?.(q2.id, next);
      setSaved(true);
    }, DRAFT_MS);
  };
  const finish = (act) => {
    cancelDraft();
    setDirty(false);
    act();
  };
  const close = () => finish(() => p3.onClose?.(q2.id));
  const done = (r3) => unchanged(q2, draft) ? close() : finish(() => p3.onDone(q2.id, r3));
  const skip = () => q2.status !== "open" && q2.response?.kind === "skip" ? close() : finish(() => p3.onSkip(q2.id));
  const unsent = retracted && dirty && draft.text.trim() !== "" ? draft.text : "";
  return /* @__PURE__ */ a3(
    "div",
    {
      ref: root2,
      "data-qid": q2.id,
      tabIndex: -1,
      hidden: p3.hidden,
      class: `rt-card${fold.shown ? " is-expanded" : ""}${retracted ? " is-retracted" : ""}${q2.isNew ? " is-new" : ""}${quiet ? " is-quiet" : ""}${p3.focused ? " is-kbd-focus" : ""}`,
      children: [
        !fold.shown && /* @__PURE__ */ a3(Row, { q: q2, p: p3 }),
        fold.shown && /* @__PURE__ */ a3("div", { class: `rt-card-fold${fold.closing ? " is-closing" : ""}`, inert: fold.closing, children: /* @__PURE__ */ a3("div", { class: "rt-card-fold-inner", children: [
          /* @__PURE__ */ a3("div", { class: "rt-card-head", children: [
            /* @__PURE__ */ a3(StateIcon, { info }),
            /* @__PURE__ */ a3("span", { class: "rt-qid", children: q2.id }),
            q2.isNew && /* @__PURE__ */ a3("span", { class: "rt-badge-new", children: "New" }),
            /* @__PURE__ */ a3(StateLabel, { info })
          ] }),
          /* @__PURE__ */ a3("div", { class: "rt-card-text", children: [
            /* @__PURE__ */ a3("h2", { class: "rt-card-title", children: q2.title }),
            q2.body && /* @__PURE__ */ a3("p", { class: "rt-card-body", children: q2.body })
          ] }),
          p3.readOnly && /* @__PURE__ */ a3(Answered, { q: q2 }),
          q2.decision && /* @__PURE__ */ a3("div", { class: "rt-callout", children: [
            /* @__PURE__ */ a3("div", { class: "rt-eyebrow", children: q2.status === "assumed" ? "Agent assumed" : "Agent decided" }),
            /* @__PURE__ */ a3("div", { class: "rt-pre", children: q2.decision }),
            q2.status === "assumed" && q2.reason && /* @__PURE__ */ a3("div", { class: "rt-pre rt-why", children: [
              /* @__PURE__ */ a3("span", { class: "rt-eyebrow", children: "Why" }),
              " ",
              q2.reason
            ] })
          ] }),
          p3.readOnly && retracted && /* @__PURE__ */ a3("div", { class: "rt-callout", children: [
            /* @__PURE__ */ a3("div", { class: "rt-eyebrow", children: "Retracted by agent" }),
            /* @__PURE__ */ a3("div", { class: "rt-pre", children: q2.reason ?? "" })
          ] }),
          p3.readOnly ? /* @__PURE__ */ a3("div", { class: "rt-record-actions", children: /* @__PURE__ */ a3("button", { type: "button", class: "rt-btn rt-btn-small", "data-rt-action": "close", onClick: close, children: "Close" }) }) : /* @__PURE__ */ a3($, { children: [
            /* @__PURE__ */ a3(AnswerForm, { q: q2, draft, saved, onChange: change }),
            invalid ? /* @__PURE__ */ a3(InvalidPanel, { onCancel: () => {
              setInvalid(false);
              root2.current?.focus();
            }, onSubmit: (reason) => finish(() => p3.onInvalid(q2.id, reason)) }) : /* @__PURE__ */ a3(
              Actions,
              {
                q: q2,
                draft,
                dirty,
                onSkip: skip,
                onInvalid: () => setInvalid(true),
                onLater: () => finish(() => p3.onLater(q2.id)),
                onDone: done,
                onClose: close
              }
            )
          ] })
        ] }) }),
        unsent && /* @__PURE__ */ a3("div", { class: "rt-unsent", children: [
          /* @__PURE__ */ a3("span", { class: "rt-eyebrow", children: "Your unsent text:" }),
          /* @__PURE__ */ a3("p", { class: "rt-unsent-text", children: unsent })
        ] }),
        (p3.rejected?.length ?? 0) > 0 && /* @__PURE__ */ a3(Rejections, { q: q2, rejected: p3.rejected ?? [], onDismiss: p3.onDismiss })
      ]
    }
  );
}
function Answered({ q: q2 }) {
  const r3 = q2.response;
  const options = q2.options ?? [];
  const rec = q2.recommendation ?? "";
  return /* @__PURE__ */ a3($, { children: [
    rec && /* @__PURE__ */ a3("div", { class: "rt-callout", children: [
      /* @__PURE__ */ a3("div", { class: "rt-eyebrow", children: "Agent recommended" }),
      /* @__PURE__ */ a3("div", { class: "rt-pre", children: rec })
    ] }),
    /* @__PURE__ */ a3("div", { class: "rt-callout", children: [
      /* @__PURE__ */ a3("div", { class: "rt-eyebrow", children: "Your answer" }),
      !r3 && /* @__PURE__ */ a3("div", { class: "rt-record-none", children: "No answer was sent." }),
      r3?.kind === "skip" && /* @__PURE__ */ a3("div", { children: "You skipped. The agent decided." }),
      r3?.kind === "invalid" && /* @__PURE__ */ a3("div", { class: "rt-pre", children: `You marked the question invalid: ${r3.reason}` }),
      r3?.kind === "answer" && /* @__PURE__ */ a3($, { children: [
        options.length > 0 && /* @__PURE__ */ a3("ul", { class: "rt-record-options", children: options.map((o4) => {
          const chosen = r3.optionIds.includes(o4.id);
          return /* @__PURE__ */ a3("li", { class: `rt-record-option${chosen ? " is-chosen" : ""}`, children: [
            /* @__PURE__ */ a3("span", { class: "rt-record-mark", "aria-hidden": "true", children: chosen ? "\u2713" : "\xB7" }),
            /* @__PURE__ */ a3("span", { class: "rt-record-label", children: o4.label }),
            chosen && /* @__PURE__ */ a3("span", { class: "rt-tag", children: "Chosen" }),
            o4.recommended && /* @__PURE__ */ a3("span", { class: "rt-tag", children: "Recommended" })
          ] }, o4.id);
        }) }),
        (r3.text ?? "").trim() !== "" && /* @__PURE__ */ a3("div", { class: "rt-pre", children: r3.text }),
        (r3.note ?? "").trim() !== "" && /* @__PURE__ */ a3("div", { class: "rt-pre rt-why", children: [
          /* @__PURE__ */ a3("span", { class: "rt-eyebrow", children: "Note" }),
          " ",
          r3.note
        ] })
      ] })
    ] })
  ] });
}
function Row({ q: q2, p: p3 }) {
  const info = stateInfo(q2, p3.later);
  const summary = oneLine(q2);
  const hint = q2.status === "open" ? q2.options?.length ? `${q2.options.length} options` : "Free text" : "";
  const body = /* @__PURE__ */ a3($, { children: [
    /* @__PURE__ */ a3(StateIcon, { info }),
    /* @__PURE__ */ a3("span", { class: "rt-qid rt-row-qid", children: q2.id }),
    /* @__PURE__ */ a3("span", { class: "rt-row-main", children: [
      /* @__PURE__ */ a3("span", { class: `rt-row-title${q2.status === "retracted" ? " is-struck" : ""}`, children: q2.title }),
      summary && /* @__PURE__ */ a3("span", { class: `rt-row-sub${q2.status === "assumed" ? " is-full" : ""}`, title: q2.status === "assumed" ? void 0 : summary, children: summary }),
      q2.status === "assumed" && q2.reason && /* @__PURE__ */ a3("span", { class: "rt-row-sub is-full rt-why", children: [
        /* @__PURE__ */ a3("span", { class: "rt-eyebrow", children: "Why" }),
        " ",
        q2.reason
      ] })
    ] }),
    q2.isNew && /* @__PURE__ */ a3("span", { class: "rt-badge-new", children: "New" }),
    hint && /* @__PURE__ */ a3("span", { class: "rt-row-hint", children: hint }),
    /* @__PURE__ */ a3(StateLabel, { info })
  ] });
  if (p3.readOnly || q2.status === "open") {
    return /* @__PURE__ */ a3("button", { type: "button", class: `rt-row rt-row-button${p3.readOnly ? " is-record" : ""}`, "aria-expanded": "false", onClick: () => p3.onEdit(q2.id), children: [
      body,
      /* @__PURE__ */ a3(
        "svg",
        {
          class: "rt-chevron",
          "aria-hidden": "true",
          width: "16",
          height: "16",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "2",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          children: /* @__PURE__ */ a3("path", { d: "M6 9l6 6 6-6" })
        }
      )
    ] });
  }
  const action = q2.status === "retracted" ? null : q2.status === "done" ? "Edit" : "Reopen";
  return /* @__PURE__ */ a3("div", { class: "rt-row", children: [
    body,
    action && /* @__PURE__ */ a3("button", { type: "button", class: "rt-btn rt-btn-small", onClick: () => p3.onEdit(q2.id), children: action })
  ] });
}
function Actions({ q: q2, draft, dirty, onSkip, onInvalid, onLater, onDone, onClose }) {
  const [empty, setEmpty] = d2(false);
  A2(() => setEmpty(false), [draft]);
  const done = () => {
    if (draft.optionIds.length === 0 && draft.text.trim() === "") {
      setEmpty(true);
      return;
    }
    onDone({
      kind: "answer",
      optionIds: draft.optionIds,
      ...draft.text.trim() !== "" ? { text: draft.text } : {},
      ...draft.note.trim() !== "" ? { note: draft.note } : {}
    });
  };
  return /* @__PURE__ */ a3($, { children: [
    empty && /* @__PURE__ */ a3("p", { class: "rt-error", role: "alert", children: "Choose an option or write an answer first." }),
    /* @__PURE__ */ a3("div", { class: "rt-actions", children: [
      /* @__PURE__ */ a3("div", { class: "rt-actions-secondary", children: [
        /* @__PURE__ */ a3("button", { type: "button", class: "rt-btn-ghost", "data-rt-action": "skip", "aria-keyshortcuts": keyShortcuts("skip"), onClick: onSkip, children: [
          "Skip",
          /* @__PURE__ */ a3(KeyHint, { k: "skip" })
        ] }),
        /* @__PURE__ */ a3("button", { type: "button", class: "rt-btn-ghost", "data-rt-action": "invalid", "aria-keyshortcuts": keyShortcuts("invalid"), onClick: onInvalid, children: [
          "Invalid question",
          /* @__PURE__ */ a3(KeyHint, { k: "invalid" })
        ] }),
        q2.status === "open" && /* @__PURE__ */ a3("button", { type: "button", class: "rt-btn-ghost", "data-rt-action": "later", "aria-keyshortcuts": keyShortcuts("later"), onClick: onLater, children: [
          "Later",
          /* @__PURE__ */ a3(KeyHint, { k: "later" })
        ] }),
        q2.status !== "open" && /* @__PURE__ */ a3("button", { type: "button", class: "rt-btn-ghost", "data-rt-action": "close", "data-rt-dirty": dirty ? "" : void 0, onClick: onClose, children: dirty ? "Discard changes" : "Close, no changes" })
      ] }),
      /* @__PURE__ */ a3("button", { type: "button", class: "rt-btn-primary", "data-rt-action": "done", "aria-keyshortcuts": keyShortcuts("done"), onClick: done, children: [
        "Done",
        /* @__PURE__ */ a3(KeyHint, { k: "done" })
      ] })
    ] })
  ] });
}
function carried(q2, r3) {
  const a4 = r3.action;
  if (a4.kind === "mark") {
    const res = a4.response;
    if (res.kind === "skip") return ["Skip"];
    if (res.kind === "invalid") return [`Invalid: ${res.reason}`];
    const labels = optionLabels(q2, res.optionIds).join(", ");
    return [labels, res.text ?? "", res.note ?? ""].filter((s3) => s3.trim() !== "");
  }
  if (a4.kind === "draft") {
    const d3 = a4.draft;
    return typeof d3?.text === "string" && d3.text.trim() !== "" ? [d3.text] : [];
  }
  return [];
}
function Rejections({ q: q2, rejected, onDismiss }) {
  const id = P2();
  return /* @__PURE__ */ a3("div", { class: "rt-rejections", children: rejected.map((r3, i3) => /* @__PURE__ */ a3("div", { class: "rt-rejected", children: [
    /* @__PURE__ */ a3("div", { class: "rt-rejected-main", children: [
      /* @__PURE__ */ a3("p", { class: "rt-rejected-msg", id: `${id}-${i3}`, children: [
        "Not sent: ",
        r3.message
      ] }),
      carried(q2, r3).map((t3, j2) => /* @__PURE__ */ a3("p", { class: "rt-rejected-text", children: t3 }, j2))
    ] }),
    /* @__PURE__ */ a3(
      "button",
      {
        type: "button",
        class: "rt-btn rt-btn-small",
        "aria-describedby": `${id}-${i3}`,
        onClick: () => onDismiss?.(r3.action.cid),
        children: "Dismiss"
      }
    )
  ] }, r3.action.cid)) });
}

// web/src/Summary.tsx
var CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";
var THEME_VARS = [
  "--rt-bg",
  "--rt-surface",
  "--rt-text",
  "--rt-text-2",
  "--rt-muted",
  "--rt-border",
  "--rt-accent",
  "--rt-sent",
  "--rt-done",
  "--rt-assumed",
  "--rt-invalid"
];
var SAFE_COLOUR = /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([0-9a-z\s.,%/+-]{1,80}\)|[a-z]{3,30})$/i;
var SAFE_NAME = /^--rt-[a-z0-9-]+$/;
var FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
function buildSummaryDoc(html, themeVars) {
  const vars = Object.entries(themeVars).filter(([k2, v3]) => SAFE_NAME.test(k2) && SAFE_COLOUR.test(v3.trim())).map(([k2, v3]) => `${k2}:${v3.trim()}`).join(";");
  const css = `:root{${vars}}html{color-scheme:light dark}body{margin:0;padding:20px 24px;background:var(--rt-surface,Canvas);color:var(--rt-text,CanvasText);font:15px/1.6 ${FONT};overflow-wrap:anywhere}h1,h2,h3,h4{line-height:1.3;margin:1.2em 0 .5em}h1{font-size:1.5em}h2{font-size:1.25em}h3{font-size:1.05em}p,ul,ol{margin:.6em 0}a{color:var(--rt-accent,LinkText)}table{border-collapse:collapse;max-width:100%}th,td{border:1px solid var(--rt-border,GrayText);padding:6px 10px;text-align:left}code,pre{font-family:${MONO};font-size:.9em}pre{overflow:auto;padding:12px;border:1px solid var(--rt-border,GrayText);border-radius:8px}svg{max-width:100%}img{max-width:100%}`;
  return `<!doctype html>
<html><head>
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta charset="utf-8">
<style>${css}</style>
</head>
<body>
${html}
</body></html>`;
}
function readThemeVars() {
  const out = {};
  try {
    const cs = getComputedStyle(document.documentElement);
    for (const name of THEME_VARS) {
      const v3 = cs.getPropertyValue(name).trim();
      if (v3) out[name] = v3;
    }
  } catch {
  }
  return out;
}
function useThemeVars() {
  const [vars, setVars] = d2(readThemeVars);
  A2(() => {
    const update = () => setVars((prev) => {
      const next = readThemeVars();
      return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    });
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    mq?.addEventListener?.("change", update);
    update();
    return () => {
      observer.disconnect();
      mq?.removeEventListener?.("change", update);
    };
  }, []);
  return vars;
}
function Summary({ state, outbox, offline, confirmPending, rejected, onChange, onViewList }) {
  const summary = state.summary;
  const themeVars = useThemeVars();
  const doc = w2(() => buildSummaryDoc(summary?.html ?? "", themeVars), [summary?.html, themeVars]);
  const [big, setBig] = d2(false);
  const [note, setNote] = d2("");
  const [missing, setMissing] = d2(false);
  const noteRef = T2(null);
  if (!summary) return null;
  const closed = state.phase === "confirmed" && !confirmPending;
  const assumed = state.order.map((qid) => state.questions[qid]).filter((q2) => q2?.status === "assumed");
  const notYet = () => {
    const text = note.trim();
    if (text === "") {
      setMissing(true);
      noteRef.current?.focus();
      return;
    }
    outbox.enqueue({ kind: "reopen", note: text });
    setNote("");
    setMissing(false);
  };
  const exportMd = () => {
    const url = URL.createObjectURL(new Blob([summary.markdown], { type: "text/markdown;charset=utf-8" }));
    const a4 = document.createElement("a");
    a4.href = url;
    a4.download = `${state.id}-summary.md`;
    document.body.appendChild(a4);
    a4.click();
    a4.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return /* @__PURE__ */ a3("section", { class: "rt-summary", "aria-label": "Summary", children: [
    /* @__PURE__ */ a3("div", { class: "rt-summary-head", children: [
      /* @__PURE__ */ a3("h2", { class: "rt-summary-title", children: closed ? "Shared understanding, confirmed" : "Do we have a shared understanding?" }),
      /* @__PURE__ */ a3("button", { type: "button", class: "rt-btn rt-view-list", onClick: onViewList, children: closed ? "View questions and answers" : "Review questions and answers" }),
      /* @__PURE__ */ a3("button", { type: "button", class: "rt-btn rt-export", onClick: exportMd, children: [
        /* @__PURE__ */ a3(
          "svg",
          {
            "aria-hidden": "true",
            width: "16",
            height: "16",
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            "stroke-width": "2",
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            children: [
              /* @__PURE__ */ a3("path", { d: "M12 4v11" }),
              /* @__PURE__ */ a3("path", { d: "M7 11l5 5 5-5" }),
              /* @__PURE__ */ a3("path", { d: "M5 20h14" })
            ]
          }
        ),
        " ",
        "Export Markdown"
      ] })
    ] }),
    /* @__PURE__ */ a3("div", { class: "rt-summary-frame-card", children: [
      /* @__PURE__ */ a3("div", { class: "rt-summary-frame-bar", children: [
        /* @__PURE__ */ a3("span", { class: "rt-eyebrow", children: "Summary from the agent" }),
        /* @__PURE__ */ a3("button", { type: "button", class: "rt-btn rt-btn-small", "aria-expanded": big, onClick: () => setBig(!big), children: big ? "Collapse" : "Expand" })
      ] }),
      summary.abstract && /* @__PURE__ */ a3("p", { class: "rt-summary-abstract rt-pre", children: summary.abstract }),
      /* @__PURE__ */ a3(
        "iframe",
        {
          class: "rt-summary-frame",
          title: "Summary from the agent",
          sandbox: "",
          referrerpolicy: "no-referrer",
          style: { height: big ? "90vh" : "min(70vh, 720px)" },
          srcdoc: doc
        }
      )
    ] }),
    assumed.length > 0 && /* @__PURE__ */ a3("section", { class: "rt-assumed-list", "aria-label": "Decisions assumed by the agent", children: [
      /* @__PURE__ */ a3("h3", { class: "rt-assumed-title", children: [
        "Assumed by agent (",
        assumed.length,
        "). Check these before you confirm."
      ] }),
      assumed.map((q2) => q2 && /* @__PURE__ */ a3("div", { class: "rt-assumed-row", children: [
        /* @__PURE__ */ a3("span", { class: "rt-qid", children: q2.id }),
        /* @__PURE__ */ a3("div", { class: "rt-assumed-text", children: [
          /* @__PURE__ */ a3("div", { class: "rt-assumed-decision", children: q2.decision ?? q2.title }),
          q2.reason && /* @__PURE__ */ a3("div", { class: "rt-assumed-reason", children: `Why: ${q2.reason}` })
        ] }),
        !closed && !confirmPending && /* @__PURE__ */ a3("button", { type: "button", class: "rt-btn", onClick: () => onChange(q2.id), children: "Change" })
      ] }, q2.id))
    ] }),
    closed ? /* @__PURE__ */ a3("p", { class: "rt-summary-closed", role: "status", children: [
      /* @__PURE__ */ a3("span", { class: "rt-state-label", children: "Closed" }),
      " The session is confirmed and read-only."
    ] }) : /* @__PURE__ */ a3("div", { class: "rt-confirm-block", children: [
      /* @__PURE__ */ a3("label", { class: "rt-confirm-label", for: "rt-notyet", children: "Not there yet? Tell the agent what is missing." }),
      /* @__PURE__ */ a3(
        "textarea",
        {
          id: "rt-notyet",
          ref: noteRef,
          class: "rt-confirm-note",
          rows: 3,
          value: note,
          "aria-describedby": missing ? "rt-notyet-error" : void 0,
          "aria-invalid": missing,
          onInput: (e3) => {
            setNote(e3.target.value);
            if (missing) setMissing(false);
          }
        }
      ),
      missing && /* @__PURE__ */ a3("p", { id: "rt-notyet-error", class: "rt-confirm-error", children: "Add a note so the agent knows what is missing." }),
      /* @__PURE__ */ a3("div", { class: "rt-confirm-actions", children: [
        /* @__PURE__ */ a3("p", { class: "rt-confirm-hint", children: "Confirming closes the session and makes it read-only." }),
        /* @__PURE__ */ a3("button", { type: "button", class: "rt-btn", disabled: confirmPending, onClick: notYet, children: "Not yet, keep grilling" }),
        /* @__PURE__ */ a3("button", { type: "button", class: "rt-btn-accent", onClick: () => {
          if (!confirmPending) outbox.enqueue({ kind: "confirm" });
        }, children: [
          /* @__PURE__ */ a3(
            "svg",
            {
              "aria-hidden": "true",
              width: "16",
              height: "16",
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              "stroke-width": "2.4",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              children: /* @__PURE__ */ a3("path", { d: "M5 12.5l4.5 4.5L19 7.5" })
            }
          ),
          "Confirm shared understanding"
        ] })
      ] }),
      rejected.map((r3) => /* @__PURE__ */ a3("p", { class: "rt-confirm-error", role: "alert", children: [
        `Not sent: ${r3.message}`,
        " ",
        /* @__PURE__ */ a3("button", { type: "button", class: "rt-btn rt-btn-small", onClick: () => outbox.dismissRejected(r3.action.cid), children: "Dismiss" })
      ] }, r3.action.cid)),
      offline && /* @__PURE__ */ a3("p", { class: "rt-confirm-offline", children: "The confirmation will be sent when the agent is back." })
    ] })
  ] });
}

// web/src/outbox.ts
var HEALTH_RETRY_MS = 2e3;
function newCid() {
  const c3 = globalThis.crypto;
  if (typeof c3?.randomUUID === "function") return c3.randomUUID();
  const b2 = new Uint8Array(16);
  if (typeof c3?.getRandomValues === "function") c3.getRandomValues(b2);
  else for (let i3 = 0; i3 < 16; i3++) b2[i3] = Math.floor(Math.random() * 256);
  b2[6] = b2[6] & 15 | 64;
  b2[8] = b2[8] & 63 | 128;
  const h3 = [...b2].map((x2) => x2.toString(16).padStart(2, "0")).join("");
  return `${h3.slice(0, 8)}-${h3.slice(8, 12)}-${h3.slice(12, 16)}-${h3.slice(16, 20)}-${h3.slice(20)}`;
}
function readJson(storage, key) {
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}
function loadCached(pk, id, storage) {
  const c3 = readJson(storage, `rt-state-${pk}-${id}`);
  return c3 && typeof c3 === "object" && c3.state && typeof c3.state === "object" ? c3 : null;
}
function saveCached(pk, id, c3, storage) {
  try {
    storage.setItem(`rt-state-${pk}-${id}`, JSON.stringify(c3));
  } catch {
  }
}
function createOutbox(pk, id, deps) {
  const { send, storage } = deps;
  const outboxKey = `rt-outbox-${pk}-${id}`;
  const rejectedKey = `rt-rejected-${pk}-${id}`;
  const health = deps.health ?? (async () => {
    try {
      return (await fetch("/api/health", { credentials: "same-origin" })).ok;
    } catch {
      return false;
    }
  });
  const timers = deps.timers ?? {
    set: (fn, ms) => globalThis.setInterval(fn, ms),
    clear: (h3) => globalThis.clearInterval(h3)
  };
  let queue = readJson(storage, outboxKey) ?? [];
  let rejectedList = readJson(storage, rejectedKey) ?? [];
  if (!Array.isArray(queue)) queue = [];
  if (!Array.isArray(rejectedList)) rejectedList = [];
  let isOnline = true, isAuthLost = false, saved = true, disposed = false;
  let inFlight;
  let running;
  let timer;
  let subs = /* @__PURE__ */ new Set();
  const notify = () => {
    for (const cb of [...subs]) cb();
  };
  const persist = () => {
    try {
      storage.setItem(outboxKey, JSON.stringify(queue));
      storage.setItem(rejectedKey, JSON.stringify(rejectedList));
      saved = true;
    } catch {
      saved = false;
    }
  };
  function stopHealth() {
    if (timer !== void 0) {
      timers.clear(timer);
      timer = void 0;
    }
  }
  function goOffline() {
    isOnline = false;
    if (timer !== void 0 || disposed) return;
    let checking = false;
    timer = timers.set(() => {
      if (checking) return;
      checking = true;
      health().then((ok) => {
        if (disposed || !ok) return;
        isOnline = true;
        stopHealth();
        notify();
        void flush();
      }, () => {
      }).finally(() => {
        checking = false;
      });
    }, HEALTH_RETRY_MS);
  }
  async function run() {
    while (!disposed) {
      const a4 = queue[0];
      if (!a4) break;
      inFlight = a4.cid;
      let res;
      try {
        res = await send(a4);
      } catch {
        inFlight = void 0;
        goOffline();
        notify();
        return;
      }
      inFlight = void 0;
      if (disposed) return;
      if (res.status === 401) {
        isAuthLost = true;
        notify();
        return;
      }
      if (res.status >= 500) {
        goOffline();
        notify();
        return;
      }
      isAuthLost = false;
      queue = queue.filter((x2) => x2.cid !== a4.cid);
      if (res.status >= 400) {
        const body = res.body ?? {};
        rejectedList = [...rejectedList, {
          action: a4,
          code: typeof body.error === "string" ? body.error : `http_${res.status}`,
          message: typeof body.message === "string" ? body.message : `The server refused this action (${res.status}).`
        }];
      }
      if (!isOnline) {
        isOnline = true;
        stopHealth();
      }
      persist();
      notify();
    }
  }
  function flush() {
    if (running) return running;
    running = run().finally(() => {
      running = void 0;
      if (queue.length > 0 && isOnline && !isAuthLost && !disposed) return flush();
    });
    return running;
  }
  function enqueue(input) {
    if (disposed) return;
    const a4 = { ...input, cid: newCid(), at: (/* @__PURE__ */ new Date()).toISOString() };
    const last = queue[queue.length - 1];
    if (a4.kind === "draft" && last?.kind === "draft" && last.qid === a4.qid && last.cid !== inFlight) {
      queue = [...queue.slice(0, -1), a4];
    } else {
      queue = [...queue, a4];
    }
    persist();
    if (a4.kind === "draft") {
      const c3 = loadCached(pk, id, storage);
      if (c3) saveCached(pk, id, { ...c3, drafts: { ...c3.drafts, [a4.qid]: a4.draft } }, storage);
    }
    notify();
    void flush();
  }
  return {
    enqueue,
    flush,
    pending: () => [...queue],
    rejected: () => [...rejectedList],
    dismissRejected(cid) {
      rejectedList = rejectedList.filter((r3) => r3.action.cid !== cid);
      persist();
      notify();
    },
    online: () => isOnline,
    authLost: () => isAuthLost,
    storageOk: () => saved,
    subscribe(cb) {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    dispose() {
      disposed = true;
      stopHealth();
      subs = /* @__PURE__ */ new Set();
    }
  };
}
var settledLike = (s3) => s3 === "sent" || s3 === "settled" || s3 === "assumed";
function applyPending(state, pending) {
  const questions = { ...state.questions };
  let phase = state.phase;
  let totalAtLastBatch = state.progress.totalAtLastBatch;
  const live = () => Object.values(questions).filter((q2) => q2.status !== "retracted").length;
  for (const a4 of pending) {
    switch (a4.kind) {
      case "mark": {
        const q2 = questions[a4.qid];
        if (!q2 || q2.status === "retracted") break;
        const { decision: _d, reason: _r, ...rest } = q2;
        questions[a4.qid] = {
          ...rest,
          status: "done",
          response: a4.response,
          isNew: false,
          isRevision: settledLike(q2.status) || q2.status === "done" && q2.isRevision
        };
        if (phase === "summary") phase = "active";
        break;
      }
      case "clear": {
        const q2 = questions[a4.qid];
        if (!q2 || q2.status !== "done") break;
        const { response: _x, ...rest } = q2;
        const orig = state.questions[a4.qid];
        questions[a4.qid] = {
          ...rest,
          status: "open",
          isRevision: false,
          isNew: orig?.status === "open" ? orig.isNew : false
        };
        break;
      }
      case "respond":
        for (const [qid, q2] of Object.entries(questions)) {
          if (q2.status === "done") questions[qid] = { ...q2, status: "sent", isRevision: false };
          else if (q2.status === "open" && q2.isNew) questions[qid] = { ...q2, isNew: false };
        }
        totalAtLastBatch = live();
        break;
      case "confirm":
        phase = "confirmed";
        break;
      case "reopen":
        phase = "active";
        break;
      case "draft":
        break;
    }
  }
  const progress = { total: 0, sent: 0, done: 0, open: 0, newCount: 0, totalAtLastBatch };
  for (const q2 of Object.values(questions)) {
    if (q2.status === "retracted") continue;
    progress.total += 1;
    if (settledLike(q2.status)) progress.sent += 1;
    else if (q2.status === "done") progress.done += 1;
    else progress.open += 1;
    if (q2.isNew) progress.newCount += 1;
  }
  return { ...state, phase, questions, progress, unsentCount: progress.done };
}

// web/src/useSessionData.ts
var initial = (key) => ({ key, payload: null, loadError: null, fetchAuthLost: false, failures: 0 });
var RETRY_MS = 3e3;
function httpStatus(e3) {
  const status = e3?.status;
  return typeof status === "number" ? status : null;
}
function createSession(pk, id, storage, deps, update) {
  const key = `${pk}/${id}`;
  const d3 = () => deps.current;
  const timers = d3().timers;
  const outbox = createOutbox(pk, id, {
    send: (a4) => (d3().send ?? ((x2) => d3().api.send(pk, id, x2)))(a4),
    storage,
    health: () => d3().api.health().then(() => true, () => false),
    ...timers ? { timers } : {}
  });
  const cached = loadCached(pk, id, storage);
  const net = { alive: true, busy: false, again: false, seq: 0, delivered: [] };
  function refetch() {
    if (!net.alive) return;
    if (net.busy) {
      net.again = true;
      return;
    }
    net.busy = true;
    const seq = ++net.seq;
    d3().api.getSession(pk, id).then((p3) => {
      if (!net.alive) return;
      if (!p3 || typeof p3 !== "object" || !p3.state) throw new Error("malformed session payload");
      saveCached(pk, id, { state: p3.state, drafts: p3.drafts ?? {} }, storage);
      net.delivered = net.delivered.filter((x2) => x2.seq >= seq);
      d3().beforeUpdate?.();
      update(key, () => ({ ...initial(key), payload: p3 }));
    }).catch((e3) => {
      if (!net.alive) return;
      const status = httpStatus(e3);
      if (status === 404) update(key, (f4) => ({ ...f4, loadError: "not_found" }));
      else if (status === 409) update(key, (f4) => ({ ...f4, loadError: "unsupported" }));
      else {
        d3().beforeUpdate?.();
        if (status === 401) update(key, (f4) => ({ ...f4, fetchAuthLost: true }));
        else update(key, (f4) => ({ ...f4, failures: f4.failures + 1 }));
      }
    }).finally(() => {
      net.busy = false;
      if (net.again && net.alive) {
        net.again = false;
        refetch();
      }
    });
  }
  function start(rerender) {
    let prev = outbox.pending();
    let wasOnline = outbox.online();
    let wasAuthLost = outbox.authLost();
    const unsubscribe = outbox.subscribe(() => {
      const now = outbox.pending();
      const left = new Set(now.map((a4) => a4.cid));
      const refused = new Set(outbox.rejected().map((r3) => r3.action.cid));
      const delivered = prev.filter((a4) => a4.kind !== "draft" && !left.has(a4.cid) && !refused.has(a4.cid));
      prev = now;
      const back = !wasOnline && outbox.online();
      const bannerMayChange = wasOnline !== outbox.online() || wasAuthLost !== outbox.authLost();
      wasOnline = outbox.online();
      wasAuthLost = outbox.authLost();
      net.delivered.push(...delivered.map((a4) => ({ a: a4, seq: net.seq })));
      if (bannerMayChange) d3().beforeUpdate?.();
      rerender();
      if (delivered.length > 0 || back) refetch();
    });
    const unlisten = d3().api.subscribe((e3) => {
      if (!("pk" in e3) || e3.pk !== pk || e3.id !== id) return;
      refetch();
      if (!outbox.online()) void outbox.flush();
    });
    refetch();
    void outbox.flush();
    return () => {
      net.alive = false;
      unsubscribe();
      unlisten();
      setTimeout(() => outbox.dispose(), 0);
    };
  }
  return { key, outbox, cached, net, refetch, start };
}
function useSessionData(deps) {
  const { pk, id, storage } = deps;
  const key = `${pk}/${id}`;
  const depsRef = T2(deps);
  depsRef.current = deps;
  const [fetched, setFetched] = d2(() => initial(key));
  const [, setTick] = d2(0);
  const session = w2(() => createSession(
    pk,
    id,
    storage,
    depsRef,
    (k2, f4) => setFetched((prev) => k2 === key ? f4(prev.key === k2 ? prev : initial(k2)) : prev)
  ), [key, storage]);
  A2(() => session.start(() => setTick((t3) => t3 + 1)), [session]);
  const cur = fetched.key === key ? fetched : initial(key);
  A2(() => {
    if (cur.failures === 0) return;
    const t3 = setTimeout(() => session.refetch(), RETRY_MS);
    return () => clearTimeout(t3);
  }, [session, cur.failures]);
  const { outbox, cached } = session;
  const base = cur.payload?.state ?? cached?.state ?? null;
  const pending = outbox.pending();
  const delivered = session.net.delivered.map((x2) => x2.a);
  const state = base ? applyPending(base, [...delivered, ...pending]) : null;
  const drafts = { ...cur.payload?.drafts ?? cached?.drafts ?? {} };
  for (const a4 of pending) if (a4.kind === "draft") drafts[a4.qid] = a4.draft;
  const lastRespond = pending.map((a4) => a4.kind).lastIndexOf("respond");
  const queued = lastRespond < 0 || !base ? null : applyPending(base, [...delivered, ...pending.slice(0, lastRespond)]).unsentCount;
  return {
    outbox,
    /** Changes identity only when a fetched payload lands. */
    payload: cur.payload,
    state,
    drafts,
    queued,
    loadError: cur.loadError,
    failures: cur.failures,
    offline: !outbox.online() || cur.failures > 0,
    authLost: outbox.authLost() || cur.fetchAuthLost
  };
}

// web/src/SessionView.tsx
var FILTERS = [
  { key: "all", label: "All" },
  { key: "unanswered", label: "Unanswered" },
  { key: "new", label: "New" },
  { key: "assumed", label: "Assumed by agent" }
];
var matches = (q2, f4) => f4 === "all" || f4 === "unanswered" && q2.status === "open" || f4 === "new" && q2.isNew || f4 === "assumed" && q2.status === "assumed";
var OFFLINE = "The agent's session is closed. Your answers are saved in this browser and will be sent when it is back.";
var AUTH_LOST = "This page lost its access. Open the link from your terminal again.";
var NOT_SAVED = "Your answers are not being saved in this browser. Keep this tab open until they are sent.";
function browserStorage() {
  try {
    if (window.localStorage) return window.localStorage;
  } catch {
  }
  return {
    length: 0,
    clear() {
    },
    getItem: () => null,
    key: () => null,
    removeItem() {
    },
    setItem() {
      throw new Error("storage unavailable");
    }
  };
}
function readLater(storage, key) {
  try {
    const v3 = JSON.parse(storage.getItem(key) ?? "[]");
    return Array.isArray(v3) ? v3.filter((x2) => typeof x2 === "string") : [];
  } catch {
    return [];
  }
}
function asDraft(v3) {
  if (!v3 || typeof v3 !== "object") return void 0;
  const d3 = v3;
  if (!Array.isArray(d3.optionIds) || typeof d3.text !== "string" || typeof d3.note !== "string") return void 0;
  return { optionIds: d3.optionIds.filter((x2) => typeof x2 === "string"), text: d3.text, note: d3.note };
}
var cardEl = (root2, qid) => [...root2?.querySelectorAll("[data-qid]") ?? []].find((el) => el.dataset.qid === qid) ?? null;
function firstOpen(s3, later) {
  return s3.order.find((qid) => s3.questions[qid]?.status === "open" && !later.includes(qid)) ?? null;
}
var plural = (n2, word) => n2 === 1 ? word : `${word}s`;
function statusLine(s3) {
  if (s3.phase === "confirmed") return { text: "Session closed", working: false };
  if (s3.phase === "summary") return { text: "Agent posted a summary and is waiting for your confirmation", working: false };
  const custom = s3.agentStatus?.trim();
  if (custom) return { text: custom, working: s3.pendingWake };
  if (s3.pendingWake) {
    const n2 = Object.values(s3.questions).filter((q2) => q2.status === "sent").length;
    return { text: n2 > 0 ? `Agent is working through your ${n2} ${plural(n2, "update")}` : "Agent is working", working: true };
  }
  if (s3.progress.open > 0) return { text: "Agent is waiting for you", working: false };
  if (s3.progress.total === 0) return { text: "Agent is preparing questions", working: false };
  return { text: "All questions answered", working: false };
}
function SessionView({ pk, id, dir, api: api2 = api, storage: storageProp, send, timers }) {
  const [storage] = d2(() => storageProp ?? browserStorage());
  const listRef = T2(null);
  const respondRef = T2(null);
  const focusAfter = T2(null);
  const anchor = T2(null);
  const [focused, setFocused] = d2(null);
  const focusedRef = T2(focused);
  focusedRef.current = focused;
  const [help, setHelp] = d2(false);
  const keyRun = T2(() => false);
  useSessionKeys((a4, target) => keyRun.current(a4, target));
  const data = useSessionData({
    pk,
    id,
    api: api2,
    storage,
    send,
    timers,
    // Remember where the card the user is in sits, so the layout effect below can keep it there.
    beforeUpdate: () => {
      const active = document.activeElement?.closest?.("[data-qid]") ?? cardEl(listRef.current, focusedRef.current ?? "");
      anchor.current = active ? { el: active, top: active.getBoundingClientRect().top } : null;
    }
  });
  const { outbox, state, drafts, queued, offline, authLost } = data;
  const laterKey = `rt-later-${pk}-${id}`;
  const [later, setLater] = d2(() => readLater(storage, laterKey));
  const [filter, setFilter] = d2("all");
  const [expanded, setExpanded] = d2(void 0);
  const [listFromSummary, setListFromSummary] = d2(false);
  const [records, setRecords] = d2([]);
  const phase = data.state?.phase;
  A2(() => {
    if (phase === "active" && listFromSummary) setListFromSummary(false);
  }, [phase, listFromSummary]);
  F2(() => {
    const a4 = anchor.current;
    anchor.current = null;
    if (!a4 || !a4.el.isConnected) return;
    const delta = a4.el.getBoundingClientRect().top - a4.top;
    if (delta !== 0) window.scrollBy(0, delta);
  }, [data.payload, offline, authLost]);
  const shownExpanded = expanded !== void 0 ? expanded : state ? firstOpen(state, later) : null;
  F2(() => {
    if (expanded === void 0 && state) setExpanded(shownExpanded);
  });
  A2(() => {
    const target = focusAfter.current;
    if (target === null) return;
    const root2 = (qid) => cardEl(listRef.current, qid);
    if (target.card) {
      focusAfter.current = null;
      root2(target.from)?.focus();
      return;
    }
    if (target.next !== null && !root2(target.next)?.classList.contains("is-expanded") && target.waits++ < 2) return;
    focusAfter.current = null;
    if (target.next !== null) {
      const card = root2(target.next);
      (card?.querySelector("input, textarea") ?? card)?.focus();
      if (target.scroll) card?.scrollIntoView?.({ block: "center" });
    } else if (respondRef.current && !respondRef.current.disabled) {
      respondRef.current.focus();
    } else {
      root2(target.from)?.focus();
    }
  });
  if (data.loadError === "not_found") return /* @__PURE__ */ a3(Message, { text: "This session was not found." });
  if (data.loadError === "unsupported") return /* @__PURE__ */ a3(Message, { text: "Update Rotisserie to view this session." });
  if (!state) {
    if (authLost) return /* @__PURE__ */ a3(Message, { text: "This session cannot be loaded.", banner: AUTH_LOST });
    return data.failures > 0 ? /* @__PURE__ */ a3(Message, { text: "This session cannot be loaded right now. Retrying\u2026", banner: OFFLINE }) : /* @__PURE__ */ a3(Message, { text: "Loading session\u2026" });
  }
  const readOnly = state.phase === "confirmed";
  const inSummary = (state.phase === "summary" || state.phase === "confirmed") && !listFromSummary;
  const rejected = outbox.rejected();
  const orphanRejected = rejected.filter((r3) => !("qid" in r3.action) || !state.questions[r3.action.qid]);
  const activeQid = document.activeElement?.closest?.("[data-qid]")?.dataset.qid;
  const visible = (q2) => matches(q2, filter) || q2.id === activeQid;
  const isLater = (qid) => later.includes(qid) && state.questions[qid]?.status === "open";
  const saveLater = (next) => {
    setLater(next);
    try {
      storage.setItem(laterKey, JSON.stringify(next));
    } catch {
    }
  };
  const advance = (qid, nowLater) => {
    const eligible = state.order.filter((x2) => x2 === qid || !nowLater.includes(x2) && matches(state.questions[x2], filter));
    const next = nextOpen(eligible, state.questions, qid);
    setExpanded(next);
    focusAfter.current = { next, from: qid, waits: 0 };
  };
  const mark = (qid, response) => {
    outbox.enqueue({ kind: "mark", qid, response });
    const nowLater = later.filter((x2) => x2 !== qid);
    if (nowLater.length !== later.length) saveLater(nowLater);
    advance(qid, nowLater);
  };
  const handlers = {
    onDone: mark,
    onSkip: (qid) => mark(qid, { kind: "skip" }),
    onInvalid: (qid, reason) => mark(qid, { kind: "invalid", reason }),
    onLater: (qid) => {
      const nowLater = later.includes(qid) ? later : [...later, qid];
      saveLater(nowLater);
      advance(qid, nowLater);
    },
    // Edit and Reopen remove the button that was clicked, so move focus into the unfolded card; otherwise
    // focus falls to the page and the card's shortcuts stop working.
    onEdit: (qid) => {
      if (readOnly) {
        setRecords((r3) => r3.includes(qid) ? r3 : [...r3, qid]);
        focusAfter.current = { next: null, from: qid, waits: 0, card: true };
        return;
      }
      setExpanded(qid);
      focusAfter.current = { next: qid, from: qid, waits: 0 };
    },
    onClose: (qid) => {
      if (readOnly) setRecords((r3) => r3.filter((x2) => x2 !== qid));
      else setExpanded(null);
      focusAfter.current = { next: null, from: qid, waits: 0, card: true };
    },
    onDraft: (qid, draft) => outbox.enqueue({ kind: "draft", qid, draft }),
    onDismiss: (cid) => outbox.dismissRejected(cid)
  };
  const currentQid = () => document.activeElement?.closest?.("[data-qid]")?.dataset.qid ?? null;
  const press = (qid, selector) => {
    const el = cardEl(listRef.current, qid)?.querySelector(selector);
    if (!el || el instanceof HTMLButtonElement && el.disabled) return false;
    el.click();
    return true;
  };
  const moveTo = (pick) => {
    const ids = state.order.filter((x2) => cardEl(listRef.current, x2)?.hidden === false);
    const cur = currentQid();
    const target = pick(ids, cur === null ? -1 : ids.indexOf(cur));
    if (!target) return false;
    cardEl(listRef.current, target)?.focus();
    return true;
  };
  keyRun.current = (a4, target) => {
    if (a4.kind === "help") {
      setHelp(!help);
      return true;
    }
    if (a4.kind === "escape") {
      if (help) {
        setHelp(false);
        return true;
      }
      const cur2 = currentQid();
      if (cur2 && target instanceof HTMLElement && !target.hasAttribute("data-qid") && target.matches("input, textarea, select")) {
        cardEl(listRef.current, cur2)?.focus();
        return true;
      }
      return cur2 !== null && press(cur2, '[data-rt-action="close"]:not([data-rt-dirty])');
    }
    if (a4.kind === "respond") {
      const btn = respondRef.current;
      if (!btn || btn.disabled) return false;
      btn.click();
      return true;
    }
    if (a4.kind === "next") return moveTo((ids, at) => ids[at < 0 ? 0 : at + 1]);
    if (a4.kind === "prev") return moveTo((ids, at) => ids[at < 0 ? 0 : at - 1]);
    if (a4.kind === "nextNew") return moveTo((ids, at) => ids.slice(at + 1).find((x2) => state.questions[x2]?.isNew));
    const cur = currentQid() ?? (shownExpanded && cardEl(listRef.current, shownExpanded)?.hidden === false ? shownExpanded : null);
    if (!cur) return false;
    switch (a4.kind) {
      case "done":
        return press(cur, '[data-rt-action="done"]');
      case "skip":
        return press(cur, '[data-rt-action="skip"]');
      case "invalid":
        return press(cur, '[data-rt-action="invalid"]');
      case "later":
        return press(cur, '[data-rt-action="later"]');
      case "accept":
        return press(cur, '[data-rt-action="accept"]');
      case "option": {
        const input = cardEl(listRef.current, cur)?.querySelectorAll(".rt-option input")[a4.n - 1];
        if (!input || input.disabled) return false;
        input.click();
        return true;
      }
      case "unfold": {
        if (readOnly) {
          if (records.includes(cur)) handlers.onClose(cur);
          else handlers.onEdit(cur);
          return true;
        }
        if (state.questions[cur]?.status === "retracted") return false;
        if (shownExpanded === cur) {
          const card = cardEl(listRef.current, cur);
          (card?.querySelector("input, textarea") ?? card)?.focus();
        } else {
          setExpanded(cur);
          focusAfter.current = { next: cur, from: cur, waits: 0 };
        }
        return true;
      }
    }
  };
  const renderNode = (qid) => {
    const q2 = state.questions[qid];
    if (!q2) return null;
    return /* @__PURE__ */ a3("div", { class: "rt-node", children: [
      /* @__PURE__ */ a3(
        QuestionCard,
        {
          question: q2,
          draft: asDraft(drafts[qid]),
          expanded: readOnly ? records.includes(qid) : shownExpanded === qid,
          later: isLater(qid),
          readOnly,
          hidden: !visible(q2),
          focused: focused === qid,
          rejected: rejected.filter((r3) => "qid" in r3.action && r3.action.qid === qid),
          ...handlers
        }
      ),
      /* @__PURE__ */ a3("div", { class: "rt-children", children: q2.childIds.map(renderNode) })
    ] }, qid);
  };
  const roots = state.order.filter((qid) => {
    const parent = state.questions[qid]?.parentId;
    return parent === void 0 || !state.questions[parent];
  });
  const counts = {
    all: state.progress.total,
    unanswered: state.progress.open,
    new: state.progress.newCount,
    assumed: Object.values(state.questions).filter((q2) => q2.status === "assumed").length
  };
  const status = statusLine(state);
  return /* @__PURE__ */ a3("div", { class: "rt-session-view", children: [
    /* @__PURE__ */ a3("main", { class: "rt-content rt-session-main", children: [
      authLost ? /* @__PURE__ */ a3("p", { class: "rt-banner is-alert", role: "alert", children: AUTH_LOST }) : offline && /* @__PURE__ */ a3("p", { class: "rt-banner", role: "alert", children: OFFLINE }),
      !outbox.storageOk() && /* @__PURE__ */ a3("p", { class: "rt-warning", children: NOT_SAVED }),
      /* @__PURE__ */ a3("header", { class: "rt-session-header", children: [
        /* @__PURE__ */ a3("div", { class: "rt-title-row", children: [
          /* @__PURE__ */ a3("div", { class: "rt-title-block", children: [
            /* @__PURE__ */ a3("h1", { class: "rt-h1", children: state.title }),
            /* @__PURE__ */ a3("div", { class: "rt-meta", children: [
              /* @__PURE__ */ a3("span", { class: "rt-id-chip", children: state.id }),
              dir && /* @__PURE__ */ a3("span", { children: dir })
            ] })
          ] }),
          /* @__PURE__ */ a3("button", { type: "button", class: "rt-btn rt-btn-small", "aria-expanded": help, onClick: () => setHelp(!help), children: "Keyboard shortcuts" }),
          /* @__PURE__ */ a3("div", { role: "status", class: `rt-status${status.working ? " is-working" : ""}`, children: [
            status.working ? /* @__PURE__ */ a3(
              "svg",
              {
                class: "rt-spinner",
                "aria-hidden": "true",
                width: "18",
                height: "18",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                "stroke-width": "2.2",
                "stroke-linecap": "round",
                children: /* @__PURE__ */ a3("path", { d: "M12 3a9 9 0 1 0 9 9" })
              }
            ) : /* @__PURE__ */ a3("span", { class: "rt-status-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ a3("span", { children: status.text })
          ] })
        ] }),
        help && /* @__PURE__ */ a3("div", { class: "rt-keys-panel", role: "dialog", "aria-label": "Keyboard shortcuts", children: /* @__PURE__ */ a3("dl", { class: "rt-keys-list", children: shortcutList().map((r3) => /* @__PURE__ */ a3("div", { class: "rt-keys-row", children: [
          /* @__PURE__ */ a3("dt", { children: /* @__PURE__ */ a3("kbd", { class: "rt-keycap", children: r3.keys }) }),
          /* @__PURE__ */ a3("dd", { children: r3.does })
        ] }, r3.keys)) }) }),
        /* @__PURE__ */ a3(ProgressMeter, { progress: state.progress }),
        /* @__PURE__ */ a3("div", { class: "rt-filters", role: "group", "aria-label": "Filter questions", children: FILTERS.map((f4) => /* @__PURE__ */ a3("button", { type: "button", class: "rt-chip", "aria-pressed": filter === f4.key, onClick: () => setFilter(f4.key), children: [
          f4.label,
          " ",
          /* @__PURE__ */ a3("span", { class: "rt-chip-n", children: counts[f4.key] })
        ] }, f4.key)) })
      ] }),
      inSummary && /* @__PURE__ */ a3(
        Summary,
        {
          state,
          outbox,
          offline,
          confirmPending: outbox.pending().some((a4) => a4.kind === "confirm"),
          rejected: rejected.filter((r3) => r3.action.kind === "confirm" || r3.action.kind === "reopen"),
          onViewList: () => setListFromSummary(true),
          onChange: (qid) => {
            setListFromSummary(true);
            setExpanded(qid);
            focusAfter.current = { next: qid, from: qid, waits: 0, scroll: true };
          }
        }
      ),
      listFromSummary && /* @__PURE__ */ a3("div", { class: "rt-list-bar", children: [
        /* @__PURE__ */ a3("button", { type: "button", class: "rt-btn rt-btn-small rt-back-summary", onClick: () => setListFromSummary(false), children: "Back to summary" }),
        readOnly && /* @__PURE__ */ a3(
          "button",
          {
            type: "button",
            class: "rt-btn rt-btn-small",
            onClick: () => setRecords(records.length > 0 ? [] : state.order.filter((x2) => state.questions[x2])),
            children: records.length > 0 ? "Collapse all" : "Expand all"
          }
        ),
        readOnly && /* @__PURE__ */ a3("span", { class: "rt-list-note", children: "This session is closed. Questions and answers are read-only." })
      ] }),
      /* @__PURE__ */ a3(
        "div",
        {
          class: "rt-questions",
          ref: listRef,
          hidden: inSummary,
          onFocusIn: (e3) => {
            const qid = e3.target?.closest?.("[data-qid]")?.getAttribute("data-qid");
            if (qid && qid !== focused) setFocused(qid);
          },
          children: roots.map(renderNode)
        }
      )
    ] }),
    !readOnly && !inSummary && /* @__PURE__ */ a3("div", { class: "rt-respond-bar", children: /* @__PURE__ */ a3("div", { class: "rt-respond-inner", children: [
      /* @__PURE__ */ a3("div", { class: "rt-respond-text", children: [
        queued !== null ? `Queued: ${queued} ${plural(queued, "update")}` : state.unsentCount > 0 ? `${state.unsentCount} ${plural(state.unsentCount, "update")} ready to send` : "Nothing new to send. Mark an answer Done to enable Respond.",
        orphanRejected.map((r3) => /* @__PURE__ */ a3("span", { class: "rt-rejected-inline", children: [
          `Not sent: ${r3.message}`,
          /* @__PURE__ */ a3("button", { type: "button", class: "rt-btn rt-btn-small", onClick: () => outbox.dismissRejected(r3.action.cid), children: "Dismiss" })
        ] }, r3.action.cid))
      ] }),
      /* @__PURE__ */ a3(
        "button",
        {
          ref: respondRef,
          type: "button",
          class: "rt-btn-accent",
          "aria-keyshortcuts": keyShortcuts("respond"),
          disabled: state.unsentCount === 0,
          onClick: () => outbox.enqueue({ kind: "respond" }),
          children: [
            offline ? "Will send when the agent is back" : "Respond to agent",
            /* @__PURE__ */ a3(KeyHint, { k: "respond" }),
            /* @__PURE__ */ a3(
              "svg",
              {
                "aria-hidden": "true",
                width: "16",
                height: "16",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                "stroke-width": "2.2",
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
                children: [
                  /* @__PURE__ */ a3("path", { d: "M5 12h14" }),
                  /* @__PURE__ */ a3("path", { d: "M13 6l6 6-6 6" })
                ]
              }
            )
          ]
        }
      )
    ] }) })
  ] });
}
function Message({ text, banner }) {
  return /* @__PURE__ */ a3("main", { class: "rt-content", children: [
    banner && /* @__PURE__ */ a3("p", { class: "rt-banner", role: "alert", children: banner }),
    /* @__PURE__ */ a3("p", { class: "rt-muted", children: text })
  ] });
}

// web/src/Sidebar.tsx
function Logo({ size = 24 }) {
  return /* @__PURE__ */ a3(
    "svg",
    {
      class: "rt-logo",
      "aria-hidden": "true",
      width: size,
      height: size,
      viewBox: "0 0 48 48",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "4",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      children: [
        /* @__PURE__ */ a3("path", { d: "M42 24a18 18 0 1 1-18-18c5 0 9.9 2 13.5 5.5L42 16" }),
        /* @__PURE__ */ a3("path", { d: "M42 6v10H32" }),
        /* @__PURE__ */ a3("circle", { cx: "24", cy: "24", r: "5", fill: "currentColor", stroke: "none" })
      ]
    }
  );
}
function projectLabels(projects) {
  const count = /* @__PURE__ */ new Map();
  for (const p3 of projects) count.set(p3.name, (count.get(p3.name) ?? 0) + 1);
  return new Map(projects.map((p3) => {
    const parent = p3.dir.split(/[\\/]/).filter(Boolean).at(-2);
    return [p3.key, (count.get(p3.name) ?? 0) > 1 && parent ? `${p3.name} (${parent})` : p3.name];
  }));
}
function SessionLink({ p: p3, s: s3, active, onNavigate }) {
  const href = sessionPath(p3.key, s3.id);
  const { sent, done, open, total } = s3.progress;
  return /* @__PURE__ */ a3(
    "a",
    {
      class: `rt-session${active ? " is-active" : ""}`,
      href,
      "aria-current": active ? "page" : void 0,
      onClick: (e3) => {
        if (e3.defaultPrevented || e3.button !== 0 || e3.metaKey || e3.ctrlKey || e3.shiftKey || e3.altKey) return;
        e3.preventDefault();
        onNavigate(href);
      },
      children: [
        /* @__PURE__ */ a3("span", { class: "rt-session-row", children: [
          /* @__PURE__ */ a3("span", { class: "rt-session-title", children: s3.title }),
          /* @__PURE__ */ a3("span", { class: "rt-session-open", children: [
            open,
            " open"
          ] })
        ] }),
        /* @__PURE__ */ a3("span", { class: "rt-meter", "aria-hidden": "true", children: [
          /* @__PURE__ */ a3("span", { style: { flex: sent + done }, class: "rt-meter-fill" }),
          /* @__PURE__ */ a3("span", { style: { flex: Math.max(open, total === 0 ? 1 : 0) }, class: "rt-meter-rest" })
        ] })
      ]
    }
  );
}
function Groups({ projects, active, onNavigate, labels, labelSuffix = "" }) {
  return /* @__PURE__ */ a3($, { children: projects.map(({ project, sessions }) => /* @__PURE__ */ a3("section", { class: "rt-group", "aria-label": (labels.get(project.key) ?? project.name) + labelSuffix, children: [
    /* @__PURE__ */ a3("h2", { class: "rt-group-name", title: project.dir, children: labels.get(project.key) ?? project.name }),
    sessions.map((s3) => /* @__PURE__ */ a3(
      SessionLink,
      {
        p: project,
        s: s3,
        onNavigate,
        active: active?.pk === project.key && active.id === s3.id
      },
      s3.id
    ))
  ] }, project.key)) });
}
function Sidebar({ projects, active, filter, onFilter, onNavigate, shown, error }) {
  const [pastOpen, setPastOpen] = d2(false);
  const visible = projects.filter((p3) => filter === "" || p3.key === filter);
  const byPhase = (past2) => visible.map((project) => ({
    project,
    sessions: project.sessions.filter((s3) => s3.phase === "confirmed" === past2).sort((a4, b2) => b2.updatedAt.localeCompare(a4.updatedAt))
  })).filter((g3) => g3.sessions.length > 0);
  const current = byPhase(false);
  const past = byPhase(true);
  const pastCount = past.reduce((n2, g3) => n2 + g3.sessions.length, 0);
  const labels = projectLabels(projects);
  return /* @__PURE__ */ a3("nav", { class: `rt-sidebar${shown ? " is-shown" : ""}`, "aria-label": "Sessions", children: [
    /* @__PURE__ */ a3("div", { class: "rt-brand", children: [
      /* @__PURE__ */ a3(Logo, {}),
      /* @__PURE__ */ a3("span", { class: "rt-wordmark", children: "Rotisserie" })
    ] }),
    /* @__PURE__ */ a3("label", { class: "rt-filter", children: [
      /* @__PURE__ */ a3("span", { class: "rt-filter-label", children: "Project" }),
      /* @__PURE__ */ a3("select", { "aria-label": "Filter by project", value: filter, onChange: (e3) => onFilter(e3.currentTarget.value), children: [
        /* @__PURE__ */ a3("option", { value: "", children: "All projects" }),
        projects.map((p3) => /* @__PURE__ */ a3("option", { value: p3.key, children: labels.get(p3.key) ?? p3.name }, p3.key))
      ] })
    ] }),
    error && /* @__PURE__ */ a3("p", { class: "rt-empty", role: "alert", children: error }),
    /* @__PURE__ */ a3(Groups, { labels, projects: current, active, onNavigate }),
    current.length === 0 && !error && /* @__PURE__ */ a3("p", { class: "rt-empty", children: "No active sessions." }),
    /* @__PURE__ */ a3("div", { class: "rt-past", children: [
      /* @__PURE__ */ a3("button", { type: "button", class: "rt-past-toggle", "aria-expanded": pastOpen, onClick: () => setPastOpen(!pastOpen), children: [
        /* @__PURE__ */ a3(
          "svg",
          {
            "aria-hidden": "true",
            width: "16",
            height: "16",
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            "stroke-width": "2",
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            style: { transform: pastOpen ? "rotate(90deg)" : "none" },
            children: /* @__PURE__ */ a3("path", { d: "M9 6l6 6-6 6" })
          }
        ),
        "Past sessions (",
        pastCount,
        ")"
      ] }),
      pastOpen && /* @__PURE__ */ a3(Groups, { labels, projects: past, active, onNavigate, labelSuffix: ", past sessions" })
    ] })
  ] });
}

// web/src/storage.ts
function readStore(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
  }
}

// web/src/App.tsx
function systemTheme() {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}
function applyStoredTheme() {
  const t3 = readStore("rt-theme");
  if (t3 === "light" || t3 === "dark") document.documentElement.setAttribute("data-theme", t3);
}
var LIST_FAILED = "Could not load sessions. Retrying\u2026";
function Home({ hasSessions, error }) {
  return /* @__PURE__ */ a3("main", { class: "rt-content", "data-testid": "home", children: [
    /* @__PURE__ */ a3("h1", { class: "rt-h1", children: "Rotisserie" }),
    /* @__PURE__ */ a3("p", { class: "rt-muted", children: error ?? (hasSessions ? "Choose a session from the list." : "No sessions yet. Start one from Claude Code.") })
  ] });
}
function App({ api: api2 = api }) {
  const [path, setPath] = d2(window.location.pathname);
  const route = parseRoute(path);
  const [projects, setProjects] = d2([]);
  const [listError, setListError] = d2(null);
  const [filter, setFilter] = d2(() => route.name === "session" ? route.pk : readStore("rt-project") ?? "");
  const [folded, setFolded] = d2(() => readStore("rt-sidebar") === "folded");
  const [switcher, setSwitcher] = d2(false);
  const [theme, setTheme] = d2(() => {
    const t3 = readStore("rt-theme");
    return t3 === "light" || t3 === "dark" ? t3 : null;
  });
  A2(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const latest = T2(0);
  const load = b(() => {
    const n2 = ++latest.current;
    api2.listSessions().then((r3) => {
      if (n2 === latest.current) {
        setProjects(r3.projects);
        setListError(null);
      }
    }, (e3) => {
      if (n2 === latest.current) setListError(e3?.status === 401 ? AUTH_LOST : LIST_FAILED);
    });
  }, [api2]);
  A2(() => {
    load();
    let timer;
    const unsubscribe = api2.subscribe(() => {
      if (timer !== void 0) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = void 0;
        load();
      }, 300);
    });
    return () => {
      if (timer !== void 0) clearTimeout(timer);
      unsubscribe();
    };
  }, [api2, load]);
  A2(() => {
    if (listError !== LIST_FAILED) return;
    const t3 = setTimeout(load, 3e3);
    return () => clearTimeout(t3);
  }, [listError, load]);
  const routePk = route.name === "session" ? route.pk : null;
  A2(() => {
    if (routePk !== null) setFilter((f4) => f4 === "" || f4 === routePk ? f4 : routePk);
  }, [routePk]);
  A2(() => {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  const navigate = (to) => {
    window.history.pushState(null, "", to);
    setPath(to);
    setSwitcher(false);
  };
  const toggleFold = () => {
    const next = !folded;
    setFolded(next);
    writeStore("rt-sidebar", next ? "folded" : "open");
  };
  const chooseFilter = (key) => {
    setFilter(key);
    writeStore("rt-project", key);
  };
  const toggleTheme = () => {
    const next = (theme ?? systemTheme()) === "dark" ? "light" : "dark";
    setTheme(next);
    writeStore("rt-theme", next);
  };
  const sidebarVisible = route.name === "home" || !folded;
  const effectiveFilter = projects.length === 0 || projects.some((p3) => p3.key === filter) ? filter : "";
  const project = route.name === "session" ? projects.find((p3) => p3.key === route.pk) : void 0;
  const summary = route.name === "session" ? project?.sessions.find((s3) => s3.id === route.id) : void 0;
  const title = route.name === "session" ? summary?.title ?? route.id : "";
  const nextTheme = (theme ?? systemTheme()) === "dark" ? "light" : "dark";
  return /* @__PURE__ */ a3("div", { class: "rt-app", children: [
    /* @__PURE__ */ a3("div", { class: `rt-topbar${sidebarVisible ? "" : " is-folded"}`, children: [
      /* @__PURE__ */ a3(
        "button",
        {
          type: "button",
          class: "rt-icon-btn rt-fold",
          "aria-expanded": sidebarVisible,
          disabled: route.name === "home",
          "aria-label": sidebarVisible ? "Hide sessions panel" : "Show sessions panel",
          onClick: toggleFold,
          children: /* @__PURE__ */ a3(
            "svg",
            {
              "aria-hidden": "true",
              width: "18",
              height: "18",
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              "stroke-width": "2",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              children: [
                /* @__PURE__ */ a3("rect", { x: "3", y: "4", width: "18", height: "16", rx: "2" }),
                /* @__PURE__ */ a3("path", { d: "M9 4v16" })
              ]
            }
          )
        }
      ),
      /* @__PURE__ */ a3("span", { class: "rt-topbar-brand", children: [
        /* @__PURE__ */ a3(Logo, {}),
        /* @__PURE__ */ a3("span", { class: "rt-wordmark", children: "Rotisserie" })
      ] }),
      route.name === "session" && !sidebarVisible && /* @__PURE__ */ a3("span", { class: "rt-topbar-title", "data-testid": "folded-title", children: title }),
      route.name === "session" && /* @__PURE__ */ a3("button", { type: "button", class: "rt-switcher", "aria-expanded": switcher, onClick: () => setSwitcher(!switcher), children: [
        /* @__PURE__ */ a3("span", { class: "rt-muted", children: project ? `${project.name} / ` : "" }),
        title,
        /* @__PURE__ */ a3(
          "svg",
          {
            "aria-hidden": "true",
            width: "16",
            height: "16",
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            "stroke-width": "2",
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            children: /* @__PURE__ */ a3("path", { d: "M6 9l6 6 6-6" })
          }
        )
      ] }),
      /* @__PURE__ */ a3(
        "button",
        {
          type: "button",
          class: "rt-icon-btn rt-theme-toggle",
          "aria-label": `Switch to ${nextTheme} theme`,
          onClick: toggleTheme,
          children: /* @__PURE__ */ a3(
            "svg",
            {
              "aria-hidden": "true",
              width: "18",
              height: "18",
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              "stroke-width": "2",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              children: nextTheme === "dark" ? /* @__PURE__ */ a3("path", { d: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" }) : /* @__PURE__ */ a3($, { children: [
                /* @__PURE__ */ a3("circle", { cx: "12", cy: "12", r: "4" }),
                /* @__PURE__ */ a3("path", { d: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" })
              ] })
            }
          )
        }
      )
    ] }),
    /* @__PURE__ */ a3("div", { class: "rt-body", children: [
      (sidebarVisible || switcher) && /* @__PURE__ */ a3(
        Sidebar,
        {
          projects,
          filter: effectiveFilter,
          onFilter: chooseFilter,
          onNavigate: navigate,
          active: route.name === "session" ? { pk: route.pk, id: route.id } : null,
          shown: switcher || route.name === "home",
          error: listError
        }
      ),
      route.name === "session" ? /* @__PURE__ */ a3(SessionView, { pk: route.pk, id: route.id, api: api2, dir: project?.dir }, `${route.pk}/${route.id}`) : /* @__PURE__ */ a3(Home, { hasSessions: projects.some((p3) => p3.sessions.length > 0), error: listError })
    ] })
  ] });
}

// web/src/main.tsx
stripToken();
applyStoredTheme();
var root = document.getElementById("app");
if (root) Q(/* @__PURE__ */ a3(App, {}), root);
