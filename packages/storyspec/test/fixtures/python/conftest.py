# storyspec: @pytest.mark.verifies("S-001.1") names the scenario a test proves, in the JUnit report
# (pytest --junitxml) the trace reads. Optional: tier="deployed" when the tier's command doesn't select its tests.
import pytest


def pytest_configure(config):
    config.addinivalue_line("markers", "verifies(scenario, tier=None): the storyspec scenario this test proves")


@pytest.fixture(autouse=True)
def _storyspec_verifies(request, record_property):
    marker = request.node.get_closest_marker("verifies")
    if marker:
        record_property("scenario", marker.args[0])
        if marker.kwargs.get("tier"):
            record_property("tier", marker.kwargs["tier"])
