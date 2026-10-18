# storyspec: @pytest.mark.verifies("S-001.1") names the scenario a test proves, in the JUnit report
# (pytest --junitxml) the trace reads. Optional: tier="deployed" when the tier's command doesn't select its tests.
import pytest


def pytest_configure(config):
    config.addinivalue_line("markers", "verifies(scenario, tier=None): the storyspec scenario this test proves")


def pytest_collection_modifyitems(items):
    # At collection, so the scenario is in the report even when a test fails in setup.
    for item in items:
        marker = item.get_closest_marker("verifies")
        if marker:
            item.user_properties.append(("scenario", marker.args[0]))
            if marker.kwargs.get("tier"):
                item.user_properties.append(("tier", marker.kwargs["tier"]))
