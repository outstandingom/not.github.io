fetch("http://localhost:4000/api/users")
  .then(res => res.json())
  .then(data => console.log("Users from backend:", data))
  .catch(err => console.error("Error:", err));
