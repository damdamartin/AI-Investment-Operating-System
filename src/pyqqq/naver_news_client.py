"""
네이버 뉴스 API 클라이언트
"""

import aiohttp
import json
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class NaverNewsClient:
    """네이버 뉴스 검색 API 클라이언트"""

    def __init__(self, client_id: str, client_secret: str):
        """
        Args:
            client_id: 네이버 API Client ID
            client_secret: 네이버 API Client Secret
        """
        self.client_id = client_id
        self.client_secret = client_secret
        self.base_url = "https://openapi.naver.com/v1/search/news.json"

    async def get_news(
        self,
        query: str,
        display: int = 10,
        sort: str = "date"
    ) -> List[Dict]:
        """
        뉴스 검색

        Args:
            query: 검색 키워드
            display: 반환할 결과 수 (1-100, 기본값 10)
            sort: 정렬 방식 (sim: 유사도순, date: 최신순)

        Returns:
            뉴스 리스트
        """
        headers = {
            "X-Naver-Client-Id": self.client_id,
            "X-Naver-Client-Secret": self.client_secret
        }

        params = {
            "query": query,
            "display": display,
            "sort": sort,
            "start": 1
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    self.base_url,
                    headers=headers,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        items = data.get("items", [])

                        # 뉴스 정보 정제
                        news_list = []
                        for item in items:
                            news = {
                                "title": self._remove_html_tags(item.get("title", "")),
                                "description": self._remove_html_tags(item.get("description", "")),
                                "link": item.get("link", ""),
                                "pubDate": item.get("pubDate", ""),
                                "source": item.get("source", "")
                            }
                            news_list.append(news)

                        logger.info(f"✅ 네이버 뉴스 검색 성공: {query} ({len(news_list)}건)")
                        return news_list

                    else:
                        logger.error(f"❌ 네이버 API 오류 ({resp.status})")
                        return []

        except Exception as e:
            logger.error(f"❌ 뉴스 검색 오류: {e}")
            return []

    async def get_symbol_news(
        self,
        symbol_code: str,
        symbol_name: str
    ) -> List[Dict]:
        """
        종목별 뉴스 조회

        Args:
            symbol_code: 종목 코드
            symbol_name: 종목명

        Returns:
            뉴스 리스트
        """
        # 종목명 + 회사명 검색
        query = f"{symbol_name} 주식"
        return await self.get_news(query, display=10)

    @staticmethod
    def _remove_html_tags(text: str) -> str:
        """HTML 태그 제거"""
        import re
        clean = re.compile('<.*?>')
        return re.sub(clean, '', text)


if __name__ == "__main__":
    import asyncio

    async def test():
        client = NaverNewsClient(
            client_id="RIXcuCNOB_DS9AEikS40",
            client_secret="WzpIMbJ7Fb"
        )

        # 삼성전자 뉴스 조회
        news = await client.get_symbol_news("005930", "삼성전자")
        print(f"조회된 뉴스: {len(news)}건")
        for item in news[:3]:
            print(f"  - {item['title']}")
            print(f"    {item['description'][:100]}...")

    asyncio.run(test())
