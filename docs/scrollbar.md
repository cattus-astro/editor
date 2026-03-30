스크롤바는 css 를 이용해 그린다.
overflow-x: auto
overflow-y: auto
webkit-scrollbar pseudo class 를 사용한다.

```
/* 1. 스크롤이 적용될 컨테이너 */
.scroll-container {
  overflow-x: auto;
}

/* 2. 스크롤바 전체 영역 지정 (이 부분이 들어가야 Mac 기본 설정이 무시됨) */
.scroll-container::-webkit-scrollbar {
  height: 10px; /* 가로 스크롤바의 두께 (원하는 대로 조절) */
}

/* 3. 스크롤바의 트랙 (배경 부분) */
.scroll-container::-webkit-scrollbar-track {
  background: #f1f1f1; /* 트랙 색상 */
  border-radius: 8px; /* 둥근 테두리 */
}

/* 4. 스크롤바의 막대 (실제로 잡고 움직이는 부분) */
.scroll-container::-webkit-scrollbar-thumb {
  background: #888; /* 막대 색상 */
  border-radius: 8px;
}

/* (선택) 막대에 마우스를 올렸을 때 색상 변화 */
.scroll-container::-webkit-scrollbar-thumb:hover {
  background: #555;
}
```
