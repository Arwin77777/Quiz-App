const jwt = require('jsonwebtoken');

async function getToken(req)
{
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, "qwerty123");
    if(token)
        return decoded;


    return null;
}

async function getId(req)
{
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, "qwerty123");
    if(token)
        return decoded.userId;
    
    return null;
}

module.exports ={ getToken,getId};