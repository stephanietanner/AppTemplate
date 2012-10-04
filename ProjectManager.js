Ext.define('ProjectManager', {
    
    constructor: function(config) {
        this.viewport = config.viewport;
        this.capacityNotificationView = Ext.create('Ext.panel.Panel', {
            bodyPadding: 20,
            border: 0,
            layout: 'column'
        });
        this._buildIterationCombo();

        this.viewport.add(this.capacityNotificationView);
    },
    
     _buildIterationCombo: function() {
        var iterationPanel = this.viewport.add({
             xtype: 'panel',
             border: 0,
             bodyPadding: 10,
        });
        this.iterationCombo = iterationPanel.add({
            xtype: 'rallyiterationcombobox',
            listeners: {
                ready: this._loadIterationCapacities,
                scope: this
            }
        });
    },
    
    _loadIterationCapacities: function() {
         Rally.data.ModelFactory.getModel({
            type: 'Project',
            scope: this,
            success: function(projectModel) {
                projectModel.load(Rally.environment.getContext().getScope().project.ObjectID, {
                    success: function(record) {
                        this._getUserIterationCapacity(record.get('TeamMembers'));
                    },
                    scope: this
                });

            }
        });        
    },

    
    _getUserIterationCapacity: function(teamMembers) {
        this._loadTasksForIteration();
        this.teamMembers = teamMembers;
        this.teamMemberCount = teamMembers.length;
        this.iterationQuery = this.iterationCombo.getQueryFromSelected();
        Rally.data.ModelFactory.getModel({
            type: 'UserIterationCapacity',
            scope: this,
            success: function(userIterationCapacityModel) {
                for(var i = 0; i < teamMembers.length; i++) {
                    Ext.create('Rally.data.WsapiDataStore', {
                        model: userIterationCapacityModel,
                        fetch: true,
                        filters: [
                            {
                                property: 'User',
                                value: teamMembers[i]._ref
                            },
                            this.iterationQuery
                        ],
                        autoLoad: true,
                        listeners: {
                           load: {
                                fn: this._onIterationCapacityLoad,
                                scope: this
                            }
                        }
                    });
                }
            }
            
        });
    },
    _onIterationCapacityLoad: function(record) {
        if(!this.iterationLoadCount) {
            this.iterationLoadCount = 0;
        }
        this.iterationLoadCount++;
        if(record.getItems().length > 0) {
            var capacityRecords = record.getItems();
            if(!this.capacityMap) {
                this.capacityMap = [];
            }
            for(var i = 0; i < capacityRecords.length; i++) {
                var capacity = {};
                capacity.capacity = capacityRecords[i]['Capacity'];
                capacity.taskEstimates = capacityRecords[i]['TaskEstimates'];
                capacity.username = capacityRecords[i]['User']['_refObjectName'];
                capacity.userRef = capacityRecords[i]['User']['_ref'];
            }
            this.capacityMap.push(capacity);
        }
        if(this.iterationLoadCount == this.teamMemberCount) {           
            // this._getTotalToDoForUsers();
        }
    },
    buildNeedMoreWorkTemplate: function(needMoreWork) {
        var html = "";
        for(var i = 0; i < needMoreWork.length; i++) {
            html += needMoreWork[i].username + "\n";
        }
        return html;
    },
    
    _getTotalToDoForUsers: function(store, record) { 
        var userMap = {
            needMoreWork: [],
            needLessWork: []
        };
        if(this.capacityMap) {
            for(var i = 0; i < this.capacityMap.length; i++) {
                this.capacityMap[i].totalToDo = 0;
                for(var v = 0; v < record.length; v++) {
                    var task = record[v].data;
                    if(task.Owner._ref == this.capacityMap[i].userRef) {
                        this.capacityMap[i].totalToDo += task.ToDo;
                    }
                }
                var calculatedLoad = this.capacityMap[i].totalToDo / this.capacityMap[i].capacity;
                if((calculatedLoad * 100) > 100) {
                    userMap.needMoreWork.push(this.capacityMap[i]);
                }
                if((calculatedLoad * 100) < 85) {
                    userMap.needLessWork.push(this.capacityMap[i]);
                }
            }
            var needLessWorkFilter = this._getTasksForUsersWhoNeedLessWork(userMap.needLessWork);
            this.capacityNotificationView.add({
                xtype: 'panel',
                width: '40%',
                border: 1,
                style: {
                    borderColor: 'black',
                    borderStyle: 'solid'
                },                
                bodyPadding: 20,
                html: "<h1>These users could use more work</h1><span>" + this.buildNeedMoreWorkTemplate(userMap.needMoreWork) + "</span>"
            });
            this.capacityNotificationView.add({
                xtype: 'rallygrid',
                store: store,
                width: '60%',
                columnCfgs: [
                     'FormattedID',
                     'Name',
                     'Owner'
                 ],
                 filters: [
                    {
                        property:'Owner',
                        value: userMap.needLessWork[0].userRef
                    }
                 ]
            });
        }
    },

    _getTasksForUsersWhoNeedLessWork: function(needLessWork) {
        var filter = {};
        for(var i = 0; i < needLessWork.length; i++) {
            filter.property = 'Owner',
            filter.value =  needLessWork[i].userRef
        }


        return filter;
    },

    _loadTasksForIteration: function() {
         Rally.data.ModelFactory.getModel({
                type: 'Task',
                scope: this,
                success: function(taskModel) {
                    this.taskStore = Ext.create('Rally.data.WsapiDataStore', {
                        model: taskModel,
                        fetch: true,
                        filters: [
                            this.iterationQuery
                        ],
                        listeners: {
                            load: {
                                fn: this._getTotalToDoForUsers,
                                scope: this
                            }
                        },
                        autoLoad: true
                    });
                }
            });        

    }
    
 //** Need to wait for all loads to be finished and then create the Kanban app
//        if(capacityMap) {
//            this.viewport.add({
//                xtype: 'rallycardboard',
//                types: ['Tasks'],
//                attribute: 'State',
//                storeConfig: {
//                     filters: [
//                        {
//                            property: 'Iteration',
//                            value: this.iterationQuery
//                        },
//                        {
//                            property: 'User',
//                            value: capacityMap.userRef
//                            
//                        }
//                    ],
//                   fetch: '',
//                    pageSize: 20
//
//    }
});