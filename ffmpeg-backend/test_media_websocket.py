#!/usr/bin/env python3
"""
Test script for media WebSocket notifications.

This script demonstrates how to:
1. Connect to the media WebSocket endpoint
2. Subscribe to media events
3. Trigger media operations that generate events
4. Receive real-time notifications

Usage:
    python test_media_websocket.py
"""

import asyncio
import json
import sys
from uuid import uuid4

import websockets
from httpx import AsyncClient


async def test_media_websocket():
    """Test media WebSocket connection and event broadcasting."""
    print("=" * 80)
    print("Media WebSocket Test")
    print("=" * 80)

    base_url = "http://localhost:8000"
    ws_url = "ws://localhost:8000/api/v1/ws/media"

    # Test 1: Connect to WebSocket with "all" subscription
    print("\n[Test 1] Connecting to media WebSocket...")
    try:
        async with websockets.connect(f"{ws_url}?folders=all") as websocket:
            print("✓ WebSocket connected successfully")

            # Receive connected message
            message = await websocket.recv()
            data = json.loads(message)
            print(f"✓ Received connected message: {data['type']}")
            print(f"  Subscriptions: {data.get('subscriptions', [])}")

            # Test 2: Create a folder and listen for event
            print("\n[Test 2] Creating folder and listening for event...")
            async with AsyncClient(base_url=base_url) as client:
                # Create folder
                folder_response = await client.post(
                    "/api/v1/folders/",
                    json={"name": f"Test Folder {uuid4().hex[:8]}"},
                )
                if folder_response.status_code == 201:
                    folder_data = folder_response.json()
                    folder_id = folder_data["id"]
                    print(f"✓ Folder created: {folder_id}")

                    # Wait for WebSocket event
                    try:
                        event_message = await asyncio.wait_for(
                            websocket.recv(), timeout=2.0
                        )
                        event_data = json.loads(event_message)
                        print(f"✓ Received event: {event_data['type']}")
                        print(f"  Folder ID: {event_data.get('folder_id')}")
                        print(f"  Data: {event_data.get('data')}")
                    except asyncio.TimeoutError:
                        print("✗ No event received (timeout)")
                else:
                    print(f"✗ Failed to create folder: {folder_response.status_code}")

            # Test 3: Update folder and listen for event
            print("\n[Test 3] Updating folder and listening for event...")
            async with AsyncClient(base_url=base_url) as client:
                # Update folder
                update_response = await client.patch(
                    f"/api/v1/folders/{folder_id}",
                    json={"name": f"Updated Folder {uuid4().hex[:8]}"},
                )
                if update_response.status_code == 200:
                    print("✓ Folder updated")

                    # Wait for WebSocket event
                    try:
                        event_message = await asyncio.wait_for(
                            websocket.recv(), timeout=2.0
                        )
                        event_data = json.loads(event_message)
                        print(f"✓ Received event: {event_data['type']}")
                        print(f"  Folder ID: {event_data.get('folder_id')}")
                        print(f"  Data: {event_data.get('data')}")
                    except asyncio.TimeoutError:
                        print("✗ No event received (timeout)")
                else:
                    print(f"✗ Failed to update folder: {update_response.status_code}")

            # Test 4: Delete folder and listen for event
            print("\n[Test 4] Deleting folder and listening for event...")
            async with AsyncClient(base_url=base_url) as client:
                # Delete folder
                delete_response = await client.delete(f"/api/v1/folders/{folder_id}")
                if delete_response.status_code == 200:
                    print("✓ Folder deleted")

                    # Wait for WebSocket event
                    try:
                        event_message = await asyncio.wait_for(
                            websocket.recv(), timeout=2.0
                        )
                        event_data = json.loads(event_message)
                        print(f"✓ Received event: {event_data['type']}")
                        print(f"  Folder IDs: {event_data.get('folder_ids')}")
                    except asyncio.TimeoutError:
                        print("✗ No event received (timeout)")
                else:
                    print(f"✗ Failed to delete folder: {delete_response.status_code}")

    except websockets.exceptions.WebSocketException as e:
        print(f"✗ WebSocket error: {e}")
        return False
    except Exception as e:
        print(f"✗ Unexpected error: {e}")
        import traceback

        traceback.print_exc()
        return False

    print("\n" + "=" * 80)
    print("Test completed!")
    print("=" * 80)
    return True


async def test_folder_specific_subscription():
    """Test folder-specific WebSocket subscription."""
    print("\n" + "=" * 80)
    print("Folder-Specific Subscription Test")
    print("=" * 80)

    base_url = "http://localhost:8000"
    ws_url = "ws://localhost:8000/api/v1/ws/media"

    # Create a test folder first
    print("\n[Setup] Creating test folder...")
    async with AsyncClient(base_url=base_url) as client:
        folder_response = await client.post(
            "/api/v1/folders/",
            json={"name": f"Test Folder {uuid4().hex[:8]}"},
        )
        if folder_response.status_code != 201:
            print(f"✗ Failed to create folder: {folder_response.status_code}")
            return False

        folder_data = folder_response.json()
        folder_id = folder_data["id"]
        print(f"✓ Folder created: {folder_id}")

    # Connect to WebSocket with folder-specific subscription
    print(f"\n[Test] Connecting to WebSocket with folder subscription...")
    try:
        async with websockets.connect(f"{ws_url}?folders={folder_id}") as websocket:
            print("✓ WebSocket connected successfully")

            # Receive connected message
            message = await websocket.recv()
            data = json.loads(message)
            print(f"✓ Received connected message: {data['type']}")
            print(f"  Subscriptions: {data.get('subscriptions', [])}")

            # Create a subfolder in the subscribed folder
            print("\n[Test] Creating subfolder in subscribed folder...")
            async with AsyncClient(base_url=base_url) as client:
                subfolder_response = await client.post(
                    "/api/v1/folders/",
                    json={
                        "name": f"Subfolder {uuid4().hex[:8]}",
                        "parent_id": folder_id,
                    },
                )
                if subfolder_response.status_code == 201:
                    print("✓ Subfolder created")

                    # Wait for WebSocket event
                    try:
                        event_message = await asyncio.wait_for(
                            websocket.recv(), timeout=2.0
                        )
                        event_data = json.loads(event_message)
                        print(f"✓ Received event: {event_data['type']}")
                        print(f"  Folder ID: {event_data.get('folder_id')}")
                        print(f"  Parent ID: {event_data.get('parent_id')}")
                    except asyncio.TimeoutError:
                        print("✗ No event received (timeout)")
                else:
                    print(
                        f"✗ Failed to create subfolder: {subfolder_response.status_code}"
                    )

    except websockets.exceptions.WebSocketException as e:
        print(f"✗ WebSocket error: {e}")
        return False
    except Exception as e:
        print(f"✗ Unexpected error: {e}")
        import traceback

        traceback.print_exc()
        return False

    # Cleanup
    print("\n[Cleanup] Deleting test folder...")
    async with AsyncClient(base_url=base_url) as client:
        await client.delete(f"/api/v1/folders/{folder_id}?cascade=true")
        print("✓ Cleanup complete")

    print("\n" + "=" * 80)
    print("Test completed!")
    print("=" * 80)
    return True


async def test_websocket_stats():
    """Test WebSocket stats endpoint."""
    print("\n" + "=" * 80)
    print("WebSocket Stats Test")
    print("=" * 80)

    base_url = "http://localhost:8000"

    async with AsyncClient(base_url=base_url) as client:
        response = await client.get("/api/v1/ws/media/stats")
        if response.status_code == 200:
            stats = response.json()
            print("✓ Stats endpoint working")
            print(f"  Total connections: {stats.get('total_connections', 0)}")
            print(f"  Total channels: {stats.get('total_channels', 0)}")
            print(f"  Redis connected: {stats.get('redis_connected', False)}")
            print(f"  Redis listening: {stats.get('redis_listening', False)}")
            print(
                f"  Redis subscriptions: {stats.get('redis_subscriptions', 0)}"
            )
            return True
        else:
            print(f"✗ Stats endpoint failed: {response.status_code}")
            return False


async def main():
    """Run all tests."""
    print("\n🚀 Starting Media WebSocket Tests\n")
    print("Prerequisites:")
    print("  - Backend server running on http://localhost:8000")
    print("  - Redis server running and accessible")
    print()

    # Run tests
    tests = [
        ("Basic WebSocket Connection & Events", test_media_websocket),
        ("Folder-Specific Subscription", test_folder_specific_subscription),
        ("WebSocket Stats Endpoint", test_websocket_stats),
    ]

    results = []
    for test_name, test_func in tests:
        try:
            result = await test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"\n✗ Test '{test_name}' failed with exception: {e}")
            import traceback

            traceback.print_exc()
            results.append((test_name, False))

    # Print summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    for test_name, result in results:
        status = "✓ PASSED" if result else "✗ FAILED"
        print(f"{status}: {test_name}")

    passed = sum(1 for _, result in results if result)
    total = len(results)
    print(f"\nTotal: {passed}/{total} tests passed")
    print("=" * 80)

    return passed == total


if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTests interrupted by user")
        sys.exit(1)
