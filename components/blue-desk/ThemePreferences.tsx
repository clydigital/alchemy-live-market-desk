"use client";
import {useEffect,useState} from "react";
import s from "./bluebelly-chrome.module.css";
const themes=[['turquoise','Turquoise'],['neon-blue','Neon Blue'],['pastel-green','Pastel Green']] as const;
export default function ThemePreferences(){
 const [theme,setTheme]=useState('turquoise');
 useEffect(()=>{try{const saved=localStorage.getItem('bluebelly-theme');if(themes.some(([id])=>id===saved)){setTheme(saved!);document.documentElement.dataset.bluebellyTheme=saved!;}}catch{}},[]);
 function choose(value:string){setTheme(value);document.documentElement.dataset.bluebellyTheme=value;try{localStorage.setItem('bluebelly-theme',value);}catch{}}
 return <details className={s.preferences}><summary>Appearance</summary><fieldset><legend>Accent theme</legend>{themes.map(([id,label])=><label key={id}><input type="radio" name="bluebelly-theme" value={id} checked={theme===id} onChange={()=>choose(id)}/><span>{label}</span></label>)}</fieldset></details>;
}
