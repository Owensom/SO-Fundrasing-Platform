import React, { useState } from "react";

export default function App() {
  const [admin, setAdmin] = useState(true);
  const [total, setTotal] = useState(100);
  const [price, setPrice] = useState(10);
  const [selected, setSelected] = useState([]);
  const [sold, setSold] = useState([]);

  function toggle(n){
    if(sold.includes(n)) return;
    setSelected(s=> s.includes(n)? s.filter(x=>x!==n):[...s,n]);
  }

  function buy(){
    setSold([...sold,...selected]);
    setSelected([]);
  }

  return (
    <div style={{padding:20}}>
      <h1>SO Fundraising Platform</h1>
      <button onClick={()=>setAdmin(!admin)}>Admin {admin?"ON":"OFF"}</button>

      {admin && (
        <div>
          <h2>Admin Squares</h2>
          <input type="number" value={total} onChange={e=>setTotal(Math.min(500,Number(e.target.value)))} />
          <input type="number" value={price} onChange={e=>setPrice(Number(e.target.value))} />
        </div>
      )}

      <h2>Buyer Squares</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(10,1fr)",gap:5}}>
        {Array.from({length:total}).map((_,i)=>{
          const n=i+1;
          const isSold=sold.includes(n);
          const isSel=selected.includes(n);
          return (
            <button key={n}
              onClick={()=>toggle(n)}
              style={{
                padding:10,
                background:isSold?"red":isSel?"white":"black",
                color:isSel?"black":"white"
              }}>
              {n}
            </button>
          )
        })}
      </div>

      <div>Total: £{selected.length*price}</div>
      <button onClick={buy}>Buy</button>
    </div>
  );
}
