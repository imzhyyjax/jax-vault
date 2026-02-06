from fastapi import APIRouter, HTTPException
from app.db.session import get_conn
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.core.security import hash_password, verify_password, create_access_token


router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(user: UserCreate):
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM users WHERE email = %(email)s", {"email": user.email})
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="该邮箱已注册")

        cur.execute(
            """
            INSERT INTO users (email, password_hash)
            VALUES (%(email)s, %(password_hash)s)
            RETURNING id, email, created_at
            """,
            {"email": user.email, "password_hash": hash_password(user.password)},
        )
        new_user = cur.fetchone()
        conn.commit()
        return new_user
    finally:
        cur.close()
        conn.close()


@router.post("/login", response_model=TokenResponse)
def login(user: UserLogin):
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, email, password_hash FROM users WHERE email = %(email)s", {"email": user.email})
        row = cur.fetchone()
        if not row or not verify_password(user.password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="邮箱或密码错误")

        token = create_access_token({"sub": str(row["id"]), "email": row["email"]})
        return {"access_token": token, "token_type": "bearer"}
    finally:
        cur.close()
        conn.close()

