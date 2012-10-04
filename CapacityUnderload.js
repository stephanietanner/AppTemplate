Ext.define('CapacityUnderload', {
    
    constructor: function(config) {
    
        this.viewport = config.viewport;
        
        this.viewport.add({
            xtype: 'panel',
            html: 'Oh no! your capacity is below 85!'
        });
    }
       
});
