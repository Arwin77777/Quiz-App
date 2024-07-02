import React, { useEffect, useState } from 'react'
import axios from 'axios';
const Home = () => {
    const [users,setUsers] = useState([]);
    useEffect(()=>{
        axios.get("http://localhost:3000/getAllUsers")
        .then(res=>
            {
                setUsers(res.data);
                console.log(users);
            })
        .catch(err=>console.log('error:',err))
    },[])
  return (
    <div>
        <h1>Welcome to Quiz App</h1>
        <p>This is a simple quiz app built using React.</p>
        <p>To start playing, click on the 'Start Quiz' button.</p>
        {users.map((user)=>{
            return <h2 key={user.userId}>{user.email}</h2>
        })}
    </div>
  )
}

export default Home