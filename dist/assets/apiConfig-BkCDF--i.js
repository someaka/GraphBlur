(function(){const r=document.createElement("link").relList;if(r&&r.supports&&r.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))n(e);new MutationObserver(e=>{for(const t of e)if(t.type==="childList")for(const o of t.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&n(o)}).observe(document,{childList:!0,subtree:!0});function c(e){const t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?t.credentials="include":e.crossOrigin==="anonymous"?t.credentials="omit":t.credentials="same-origin",t}function n(e){if(e.ep)return;e.ep=!0;const t=c(e);fetch(e.href,t)}})();class s{constructor(r){this.enabled=r}log(...r){this.enabled&&console.log(...r)}error(...r){this.enabled&&console.error(...r)}warn(...r){this.enabled&&console.warn(...r)}table(r){this.enabled&&console.table(r)}}const l=new s(!1),a=new s(!0),f=new s(!0);function u(){return""}export{f as a,l as c,a as f,u as g};
