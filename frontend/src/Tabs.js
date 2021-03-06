import React from "react";
import PropTypes from "prop-types";
import { withStyles } from "@material-ui/core/styles";
import AppBar from "@material-ui/core/AppBar";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Typography from "@material-ui/core/Typography";
import People from "@material-ui/icons/People";
import LocalBar from "@material-ui/icons/LocalBar";
import BarChart from "@material-ui/icons/BarChart";
import ParticipantDrawer from "./ParticipantDrawer";
import ItemDrawer from "./ItemDrawer";

function TabContainer(props) {
  return (
    <Typography component="div" style={{ padding: 8 * 3 }}>
      {props.children}
    </Typography>
  );
}

const styles = theme => ({
  root: {
    width: "100%",
    backgroundColor: theme.palette.background.paper
  }
});

const drawerProps = {
  participants: {
    resourceName: "participants",
    displayName: "Participant",
    fields: [
      {
        fieldName: "firstName",
        elementId: "first-name",
        displayName: "First Name"
      },
      {
        fieldName: "lastName",
        elementId: "last-name",
        displayName: "Last Name"
      }
    ]
  },
  wines: {
    resourceName: "wines",
    displayName: "Wine",
    fields: [
      {
        fieldName: "name",
        elementId: "name",
        displayName: "Name"
      },
      {
        fieldName: "label",
        elementId: "label",
        displayName: "Label"
      }
    ]
  },
  metrics: {
    resourceName: "metrics",
    displayName: "Metric",
    fields: [
      {
        fieldName: "name",
        elementId: "name",
        displayName: "Name"
      },
      {
        fieldName: "description",
        elementId: "description",
        displayName: "Description"
      }
    ]
  }
};

class ScrollableTabsButtonForce extends React.Component {
  state = {
    value: 0
  };

  handleChange = (event, value) => {
    this.setState({ value });
  };

  render() {
    const { classes } = this.props;
    const { value } = this.state;

    return (
      <div className={classes.root}>
        <AppBar position="static" color="default">
          <Tabs
            value={this.state.value}
            onChange={this.handleChange}
            indicatorColor={"secondary"}
            textColor="secondary"
            onKeyDown={event => alert(event.key)}
            variant="fullWidth"
          >
            <Tab label="Participants" icon={<People />} />
            <Tab label="Wines" icon={<LocalBar />} />
            <Tab label="Metrics" icon={<BarChart />} />
          </Tabs>
        </AppBar>
        {value === 0 && (
          <TabContainer>
            <ParticipantDrawer />
          </TabContainer>
        )}
        {value === 1 && (
          <TabContainer>
            <ItemDrawer config={drawerProps.wines} />
          </TabContainer>
        )}
        {value === 2 && (
          <TabContainer>
            <ItemDrawer config={drawerProps.metrics} />
          </TabContainer>
        )}
      </div>
    );
  }
}

ScrollableTabsButtonForce.propTypes = {
  classes: PropTypes.object.isRequired
};

export default withStyles(styles)(ScrollableTabsButtonForce);
