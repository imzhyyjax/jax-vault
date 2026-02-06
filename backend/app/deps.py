from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from app.db.session import get_conn
from app.core.security import decode_access_token


auth_scheme = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="无效的登录信息")
        try:
            user_id = int(user_id)
        except (TypeError, ValueError):
            raise HTTPException(status_code=401, detail="无效的登录信息")
    except JWTError as e:
        print(f"[Auth] JWT error: {e}")
        raise HTTPException(status_code=401, detail="无效的登录信息")

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, email FROM users WHERE id = %(id)s", {"id": user_id})
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="用户不存在")
        return user
    finally:
        cur.close()
        conn.close()

